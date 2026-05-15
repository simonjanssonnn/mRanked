// Duel lifecycle: countdown -> problem -> submissions -> resolve.
// Server-authoritative: server stamps start time and submission times.

import type { Server } from "socket.io";
import { prisma } from "../lib/db.js";
import { pickProblemForDuel } from "../services/problems.js";
import { grade } from "../lib/grading.js";
import { applyDelta, computeDeltas, ELO_CONFIG, resolveOutcome } from "../lib/elo.js";
import { rankChange, tierForElo } from "../lib/ranks.js";

export type PlayerSlot = {
  userId: string;
  username: string;
  socketId: string | null; // null if disconnected
  elo: number;
  matches: number;
  avatarColor: string;
  avatarInitials: string;
  avatarImage: string;
  equippedTitle: string;
};

type Submission = {
  rawAnswer: string | null;
  submittedAt: number | null; // server epoch ms
};

type DuelState = {
  matchId: string;
  mode: string;
  problem: Awaited<ReturnType<typeof pickProblemForDuel>>;
  a: PlayerSlot;
  b: PlayerSlot;
  startedAt: number | null; // when problem was sent
  submissions: { a: Submission; b: Submission };
  timeoutHandle: NodeJS.Timeout | null;
  resolved: boolean;
};

const COUNTDOWN_SECONDS = 3;
// Short grace for genuine flaky network blips. Anything beyond this is treated
// as an abandonment and the opponent wins immediately.
const DISCONNECT_GRACE_MS = 3_000;

function publicProfile(p: PlayerSlot) {
  return {
    username: p.username,
    elo: p.elo,
    rank: tierForElo(p.elo).name,
    avatarColor: p.avatarColor,
    avatarInitials: p.avatarInitials,
    avatarImage: p.avatarImage,
    equippedTitle: p.equippedTitle,
  };
}

export class DuelManager {
  private duels = new Map<string, DuelState>();
  private userToMatch = new Map<string, string>();
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  matchIdForUser(userId: string): string | null {
    return this.userToMatch.get(userId) ?? null;
  }

  async startDuel(opts: {
    mode: string;
    a: PlayerSlot;
    b: PlayerSlot;
  }) {
    const targetElo = Math.round((opts.a.elo + opts.b.elo) / 2);
    const problem = await pickProblemForDuel({ mode: opts.mode, targetElo });
    if (!problem) {
      this.emitToUsers([opts.a.userId, opts.b.userId], "match:aborted", { reason: "no_problem" });
      return;
    }

    const match = await prisma.match.create({
      data: {
        mode: opts.mode,
        problemId: problem.id,
        playerAId: opts.a.userId,
        playerBId: opts.b.userId,
        aEloBefore: opts.a.elo,
        bEloBefore: opts.b.elo,
      },
    });

    const state: DuelState = {
      matchId: match.id,
      mode: opts.mode,
      problem,
      a: opts.a,
      b: opts.b,
      startedAt: null,
      submissions: { a: { rawAnswer: null, submittedAt: null }, b: { rawAnswer: null, submittedAt: null } },
      timeoutHandle: null,
      resolved: false,
    };
    this.duels.set(match.id, state);
    this.userToMatch.set(opts.a.userId, match.id);
    this.userToMatch.set(opts.b.userId, match.id);

    if (opts.a.socketId) this.io.sockets.sockets.get(opts.a.socketId)?.join(`match:${match.id}`);
    if (opts.b.socketId) this.io.sockets.sockets.get(opts.b.socketId)?.join(`match:${match.id}`);

    this.emitToUser(opts.a.userId, "match:found", {
      matchId: match.id,
      opponent: publicProfile(opts.b),
      mode: opts.mode,
    });
    this.emitToUser(opts.b.userId, "match:found", {
      matchId: match.id,
      opponent: publicProfile(opts.a),
      mode: opts.mode,
    });

    for (let s = COUNTDOWN_SECONDS; s >= 1; s--) {
      const secondsLeft = s;
      setTimeout(() => {
        this.io.to(`match:${match.id}`).emit("match:countdown", { secondsLeft });
      }, (COUNTDOWN_SECONDS - s) * 1000);
    }
    setTimeout(() => this.deliverProblem(match.id), COUNTDOWN_SECONDS * 1000);
  }

  private deliverProblem(matchId: string) {
    const d = this.duels.get(matchId);
    if (!d || d.resolved) return;
    d.startedAt = Date.now();

    const options = d.problem?.options ? safeJsonArray(d.problem.options) : undefined;
    this.io.to(`match:${matchId}`).emit("match:question", {
      questionId: d.problem!.id,
      prompt: d.problem!.prompt,
      answerType: d.problem!.answerType,
      options,
      timeLimitSec: d.problem!.timeLimitSeconds,
      calculatorAllowed: d.problem!.calculatorAllowed,
    });

    d.timeoutHandle = setTimeout(() => this.resolve(matchId, "timeout"), d.problem!.timeLimitSeconds * 1000);
  }

  handleAnswer(userId: string, payload: { matchId: string; answer: string }) {
    const d = this.duels.get(payload.matchId);
    if (!d || d.resolved || !d.startedAt) return;
    const slot = d.a.userId === userId ? "a" : d.b.userId === userId ? "b" : null;
    if (!slot) return;
    if (d.submissions[slot].submittedAt) return;

    d.submissions[slot] = {
      rawAnswer: typeof payload.answer === "string" ? payload.answer.slice(0, 500) : "",
      submittedAt: Date.now(),
    };

    const otherUserId = slot === "a" ? d.b.userId : d.a.userId;
    this.emitToUser(otherUserId, "match:opponentSubmitted", {});

    if (d.submissions.a.submittedAt && d.submissions.b.submittedAt) {
      this.resolve(d.matchId, "both_submitted");
    }
  }

  /**
   * Player explicitly abandoned the match (back button, "leave" button, tab
   * close). Settle immediately and hand the win to the opponent.
   */
  handleForfeit(userId: string) {
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return;
    const d = this.duels.get(matchId);
    if (!d || d.resolved) return;
    const slot = d.a.userId === userId ? "a" : d.b.userId === userId ? "b" : null;
    if (!slot) return;
    // Wipe their submission so resolveOutcome treats them as "no submit",
    // which gives the opponent an outright win.
    d.submissions[slot] = { rawAnswer: null, submittedAt: null };
    this.resolve(matchId, "forfeit");
  }

  handleDisconnect(userId: string) {
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return;
    const d = this.duels.get(matchId);
    if (!d || d.resolved) return;
    const slot = d.a.userId === userId ? "a" : d.b.userId === userId ? "b" : null;
    if (!slot) return;
    if (slot === "a") d.a.socketId = null;
    else d.b.socketId = null;

    setTimeout(() => {
      const cur = this.duels.get(matchId);
      if (!cur || cur.resolved) return;
      const stillGone = slot === "a" ? cur.a.socketId === null : cur.b.socketId === null;
      if (stillGone && !cur.submissions[slot].submittedAt) {
        this.resolve(matchId, "disconnect");
      }
    }, DISCONNECT_GRACE_MS);
  }

  handleReconnect(userId: string, socketId: string) {
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return;
    const d = this.duels.get(matchId);
    if (!d || d.resolved) return;
    if (d.a.userId === userId) d.a.socketId = socketId;
    if (d.b.userId === userId) d.b.socketId = socketId;
    this.io.sockets.sockets.get(socketId)?.join(`match:${matchId}`);
  }

  private async resolve(matchId: string, _trigger: string) {
    const d = this.duels.get(matchId);
    if (!d || d.resolved) return;
    d.resolved = true;
    if (d.timeoutHandle) clearTimeout(d.timeoutHandle);

    const startedAt = d.startedAt ?? Date.now();
    const aSub = d.submissions.a;
    const bSub = d.submissions.b;

    const aGrade = grade({
      answerType: d.problem!.answerType as "numeric" | "multiple_choice",
      submitted: aSub.rawAnswer,
      correctAnswer: d.problem!.correctAnswer,
      tolerance: d.problem!.tolerance ?? undefined,
      acceptableForms: d.problem!.acceptableForms ? safeJsonArray(d.problem!.acceptableForms) : undefined,
    });
    const bGrade = grade({
      answerType: d.problem!.answerType as "numeric" | "multiple_choice",
      submitted: bSub.rawAnswer,
      correctAnswer: d.problem!.correctAnswer,
      tolerance: d.problem!.tolerance ?? undefined,
      acceptableForms: d.problem!.acceptableForms ? safeJsonArray(d.problem!.acceptableForms) : undefined,
    });

    const aTimeMs = aSub.submittedAt ? aSub.submittedAt - startedAt : Infinity;
    const bTimeMs = bSub.submittedAt ? bSub.submittedAt - startedAt : Infinity;

    const outcome = resolveOutcome(
      { submitted: !!aSub.submittedAt, correct: aGrade.correct, accuracy: aGrade.accuracy, timeMs: aTimeMs },
      { submitted: !!bSub.submittedAt, correct: bGrade.correct, accuracy: bGrade.accuracy, timeMs: bTimeMs }
    );

    const { dA, dB } = computeDeltas({
      rA: d.a.elo,
      rB: d.b.elo,
      matchesA: d.a.matches,
      matchesB: d.b.matches,
      outcome,
      accuracyA: aGrade.accuracy,
      accuracyB: bGrade.accuracy,
    });

    const newA = applyDelta(d.a.elo, dA);
    const newB = applyDelta(d.b.elo, dB);

    const winnerId =
      outcome.aBase === 1 && outcome.bBase === 0 ? d.a.userId :
      outcome.aBase === 0 && outcome.bBase === 1 ? d.b.userId :
      null;

    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: matchId },
        data: {
          endedAt: new Date(),
          status: "completed",
          aAnswer: aSub.rawAnswer,
          bAnswer: bSub.rawAnswer,
          aAccuracy: aGrade.accuracy,
          bAccuracy: bGrade.accuracy,
          aTimeMs: aTimeMs === Infinity ? null : Math.round(aTimeMs),
          bTimeMs: bTimeMs === Infinity ? null : Math.round(bTimeMs),
          aEloDelta: dA,
          bEloDelta: dB,
          winnerId,
        },
      });

      const aWin = winnerId === d.a.userId;
      const bWin = winnerId === d.b.userId;
      const draw = winnerId === null;
      await tx.user.update({
        where: { id: d.a.userId },
        data: {
          classicElo: newA,
          // Peak only ever goes up; titles are unlocked at peak so they
          // can't be lost on a cold streak.
          classicPeakElo: { set: Math.max(newA, await peakFor(tx, d.a.userId)) },
          classicMatches: { increment: 1 },
          classicWins: { increment: aWin ? 1 : 0 },
          classicLosses: { increment: bWin ? 1 : 0 },
          classicDraws: { increment: draw ? 1 : 0 },
        },
      });
      await tx.user.update({
        where: { id: d.b.userId },
        data: {
          classicElo: newB,
          classicPeakElo: { set: Math.max(newB, await peakFor(tx, d.b.userId)) },
          classicMatches: { increment: 1 },
          classicWins: { increment: bWin ? 1 : 0 },
          classicLosses: { increment: aWin ? 1 : 0 },
          classicDraws: { increment: draw ? 1 : 0 },
        },
      });

      await tx.eloHistory.createMany({
        data: [
          { userId: d.a.userId, mode: d.mode, matchId, eloBefore: d.a.elo, eloAfter: newA, delta: dA },
          { userId: d.b.userId, mode: d.mode, matchId, eloBefore: d.b.elo, eloAfter: newB, delta: dB },
        ],
      });

      await tx.problem.update({
        where: { id: d.problem!.id },
        data: { timesServed: { increment: 1 } },
      });
    });

    const rankA = rankChange(d.a.elo, newA);
    const rankB = rankChange(d.b.elo, newB);

    const acceptableForms = d.problem!.acceptableForms ? safeJsonArray(d.problem!.acceptableForms) : [];

    this.emitToUser(d.a.userId, "match:result", {
      youCorrect: aGrade.correct,
      opponentCorrect: bGrade.correct,
      yourAccuracy: aGrade.accuracy,
      opponentAccuracy: bGrade.accuracy,
      yourTimeMs: aTimeMs === Infinity ? null : Math.round(aTimeMs),
      opponentTimeMs: bTimeMs === Infinity ? null : Math.round(bTimeMs),
      eloDelta: dA,
      newElo: newA,
      oldRank: rankA.oldTier.name,
      newRank: rankA.newTier.name,
      rankChanged: rankA.changed,
      rankDirection: rankA.changed ? rankA.direction : null,
      correctAnswer: d.problem!.correctAnswer,
      acceptableForms,
      solution: d.problem!.solution,
      yourAnswer: aSub.rawAnswer,
      opponentAnswer: bSub.rawAnswer,
      result: winnerId === d.a.userId ? "win" : winnerId === null ? "draw" : "loss",
      reason: _trigger,
      opponent: publicProfile(d.b),
    });

    this.emitToUser(d.b.userId, "match:result", {
      youCorrect: bGrade.correct,
      opponentCorrect: aGrade.correct,
      yourAccuracy: bGrade.accuracy,
      opponentAccuracy: aGrade.accuracy,
      yourTimeMs: bTimeMs === Infinity ? null : Math.round(bTimeMs),
      opponentTimeMs: aTimeMs === Infinity ? null : Math.round(aTimeMs),
      eloDelta: dB,
      newElo: newB,
      oldRank: rankB.oldTier.name,
      newRank: rankB.newTier.name,
      rankChanged: rankB.changed,
      rankDirection: rankB.changed ? rankB.direction : null,
      correctAnswer: d.problem!.correctAnswer,
      acceptableForms,
      solution: d.problem!.solution,
      yourAnswer: bSub.rawAnswer,
      opponentAnswer: aSub.rawAnswer,
      result: winnerId === d.b.userId ? "win" : winnerId === null ? "draw" : "loss",
      reason: _trigger,
      opponent: publicProfile(d.a),
    });

    this.userToMatch.delete(d.a.userId);
    this.userToMatch.delete(d.b.userId);
    this.duels.delete(matchId);
  }

  private emitToUser(userId: string, event: string, payload: unknown) {
    for (const [, socket] of this.io.sockets.sockets) {
      if ((socket.data as { userId?: string }).userId === userId) {
        socket.emit(event, payload);
      }
    }
  }

  private emitToUsers(userIds: string[], event: string, payload: unknown) {
    for (const u of userIds) this.emitToUser(u, event, payload);
  }
}

async function peakFor(tx: { user: { findUnique: (q: { where: { id: string }; select: { classicPeakElo: true } }) => Promise<{ classicPeakElo: number } | null> } }, userId: string): Promise<number> {
  const u = await tx.user.findUnique({ where: { id: userId }, select: { classicPeakElo: true } });
  return u?.classicPeakElo ?? 0;
}

function safeJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

void ELO_CONFIG;
