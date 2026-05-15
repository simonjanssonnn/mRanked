// Duel lifecycle: best-of-3 rounds.
//
// Each round runs the classic flow (countdown -> problem -> submissions -> resolve).
// Per-round outcomes are accumulated; at the end of round 3 we compute the match
// winner from aggregate round wins. Equal round wins = match draw (no winner,
// 0 ELO swing on the base term).
//
// Server-authoritative: server stamps start time and submission times.

import type { Server } from "socket.io";
import { prisma } from "../lib/db.js";
import { pickProblemForDuel } from "../services/problems.js";
import { grade } from "../lib/grading.js";
import { applyDelta, computeDeltas, ELO_CONFIG, resolveOutcome, type RoundOutcome } from "../lib/elo.js";
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

type Problem = NonNullable<Awaited<ReturnType<typeof pickProblemForDuel>>>;

type RoundRecord = {
  problem: Problem;
  startedAt: number | null;
  submissions: { a: Submission; b: Submission };
  outcome: RoundOutcome | null;
  aTimeMs: number;
  bTimeMs: number;
  aAccuracy: number;
  bAccuracy: number;
  aCorrect: boolean;
  bCorrect: boolean;
  aAnswer: string | null;
  bAnswer: string | null;
  timeoutHandle: NodeJS.Timeout | null;
  resolved: boolean;
};

type DuelState = {
  matchId: string;
  mode: string;
  a: PlayerSlot;
  b: PlayerSlot;
  roundIndex: number; // 0..2
  rounds: RoundRecord[];
  matchResolved: boolean;
};

const COUNTDOWN_SECONDS = 3;
const ROUNDS_PER_MATCH = 3;
const INTER_ROUND_DELAY_MS = 2500;
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

function roundWinScore(rounds: RoundRecord[]): { a: number; b: number } {
  let a = 0, b = 0;
  for (const r of rounds) {
    if (!r.outcome) continue;
    if (r.outcome.aBase === 1) a++;
    else if (r.outcome.bBase === 1) b++;
  }
  return { a, b };
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
    const firstProblem = await pickProblemForDuel({ mode: opts.mode, targetElo });
    if (!firstProblem) {
      this.emitToUsers([opts.a.userId, opts.b.userId], "match:aborted", { reason: "no_problem" });
      return;
    }

    const match = await prisma.match.create({
      data: {
        mode: opts.mode,
        problemId: firstProblem.id,
        playerAId: opts.a.userId,
        playerBId: opts.b.userId,
        aEloBefore: opts.a.elo,
        bEloBefore: opts.b.elo,
      },
    });

    const state: DuelState = {
      matchId: match.id,
      mode: opts.mode,
      a: opts.a,
      b: opts.b,
      roundIndex: 0,
      rounds: [newRoundRecord(firstProblem)],
      matchResolved: false,
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
      roundsTotal: ROUNDS_PER_MATCH,
    });
    this.emitToUser(opts.b.userId, "match:found", {
      matchId: match.id,
      opponent: publicProfile(opts.a),
      mode: opts.mode,
      roundsTotal: ROUNDS_PER_MATCH,
    });

    this.beginRoundCountdown(match.id);
  }

  private beginRoundCountdown(matchId: string) {
    const d = this.duels.get(matchId);
    if (!d || d.matchResolved) return;
    const roundNumber = d.roundIndex + 1;

    for (let s = COUNTDOWN_SECONDS; s >= 1; s--) {
      const secondsLeft = s;
      setTimeout(() => {
        const cur = this.duels.get(matchId);
        if (!cur || cur.matchResolved) return;
        this.io.to(`match:${matchId}`).emit("match:countdown", {
          secondsLeft,
          round: roundNumber,
          roundsTotal: ROUNDS_PER_MATCH,
        });
      }, (COUNTDOWN_SECONDS - s) * 1000);
    }
    setTimeout(() => this.deliverProblem(matchId), COUNTDOWN_SECONDS * 1000);
  }

  private deliverProblem(matchId: string) {
    const d = this.duels.get(matchId);
    if (!d || d.matchResolved) return;
    const round = d.rounds[d.roundIndex];
    if (!round || round.resolved) return;
    round.startedAt = Date.now();

    const options = round.problem.options ? safeJsonArray(round.problem.options) : undefined;
    const score = roundWinScore(d.rounds);
    const base = {
      questionId: round.problem.id,
      prompt: round.problem.prompt,
      answerType: round.problem.answerType,
      options,
      timeLimitSec: round.problem.timeLimitSeconds,
      calculatorAllowed: round.problem.calculatorAllowed,
      round: d.roundIndex + 1,
      roundsTotal: ROUNDS_PER_MATCH,
    };
    // Score is sent per-recipient so each side sees their own score on the left.
    this.emitToUser(d.a.userId, "match:question", { ...base, yourScore: score.a, opponentScore: score.b });
    this.emitToUser(d.b.userId, "match:question", { ...base, yourScore: score.b, opponentScore: score.a });

    round.timeoutHandle = setTimeout(
      () => this.resolveRound(matchId, "timeout"),
      round.problem.timeLimitSeconds * 1000
    );
  }

  handleAnswer(userId: string, payload: { matchId: string; answer: string }) {
    const d = this.duels.get(payload.matchId);
    if (!d || d.matchResolved) return;
    const round = d.rounds[d.roundIndex];
    if (!round || round.resolved || !round.startedAt) return;
    const slot = d.a.userId === userId ? "a" : d.b.userId === userId ? "b" : null;
    if (!slot) return;
    if (round.submissions[slot].submittedAt) return;

    round.submissions[slot] = {
      rawAnswer: typeof payload.answer === "string" ? payload.answer.slice(0, 500) : "",
      submittedAt: Date.now(),
    };

    const otherUserId = slot === "a" ? d.b.userId : d.a.userId;
    this.emitToUser(otherUserId, "match:opponentSubmitted", {});

    if (round.submissions.a.submittedAt && round.submissions.b.submittedAt) {
      this.resolveRound(d.matchId, "both_submitted");
    }
  }

  /**
   * Player explicitly abandoned the match (back button, "leave" button, tab
   * close). Settle immediately — opponent wins all remaining rounds.
   */
  handleForfeit(userId: string) {
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return;
    const d = this.duels.get(matchId);
    if (!d || d.matchResolved) return;
    const slot = d.a.userId === userId ? "a" : d.b.userId === userId ? "b" : null;
    if (!slot) return;
    this.resolveMatchByForfeit(matchId, slot);
  }

  handleDisconnect(userId: string) {
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return;
    const d = this.duels.get(matchId);
    if (!d || d.matchResolved) return;
    const slot = d.a.userId === userId ? "a" : d.b.userId === userId ? "b" : null;
    if (!slot) return;
    if (slot === "a") d.a.socketId = null;
    else d.b.socketId = null;

    setTimeout(() => {
      const cur = this.duels.get(matchId);
      if (!cur || cur.matchResolved) return;
      const stillGone = slot === "a" ? cur.a.socketId === null : cur.b.socketId === null;
      const round = cur.rounds[cur.roundIndex];
      const submitted = round && round.submissions[slot].submittedAt;
      if (stillGone && !submitted) {
        this.resolveMatchByForfeit(matchId, slot);
      }
    }, DISCONNECT_GRACE_MS);
  }

  handleReconnect(userId: string, socketId: string) {
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return;
    const d = this.duels.get(matchId);
    if (!d || d.matchResolved) return;
    if (d.a.userId === userId) d.a.socketId = socketId;
    if (d.b.userId === userId) d.b.socketId = socketId;
    this.io.sockets.sockets.get(socketId)?.join(`match:${matchId}`);
  }

  private async resolveMatchByForfeit(matchId: string, quitterSlot: "a" | "b") {
    const d = this.duels.get(matchId);
    if (!d || d.matchResolved) return;
    const round = d.rounds[d.roundIndex];
    if (round && !round.resolved) {
      // Wipe quitter's submission for the in-flight round.
      round.submissions[quitterSlot] = { rawAnswer: null, submittedAt: null };
    }
    // Fill the remaining rounds with synthetic "no submit" outcomes for the
    // quitter so the aggregate ELO calculation reflects an outright loss.
    while (d.rounds.length < ROUNDS_PER_MATCH) {
      const placeholder = d.rounds[d.rounds.length - 1].problem;
      d.rounds.push(newRoundRecord(placeholder));
    }
    for (let i = d.roundIndex; i < ROUNDS_PER_MATCH; i++) {
      const r = d.rounds[i];
      if (r.resolved) continue;
      if (r.timeoutHandle) { clearTimeout(r.timeoutHandle); r.timeoutHandle = null; }
      r.startedAt = r.startedAt ?? Date.now();
      r.submissions[quitterSlot] = { rawAnswer: null, submittedAt: null };
      const otherSlot = quitterSlot === "a" ? "b" : "a";
      // If the non-quitter happened to have already submitted this round, keep
      // it; otherwise force them an empty submission so resolveOutcome still
      // hands them the round.
      if (!r.submissions[otherSlot].submittedAt) {
        r.submissions[otherSlot] = { rawAnswer: "", submittedAt: Date.now() };
      }
      this.gradeRound(r);
      r.resolved = true;
    }
    await this.resolveMatch(matchId, "forfeit");
  }

  private async resolveRound(matchId: string, trigger: string) {
    const d = this.duels.get(matchId);
    if (!d || d.matchResolved) return;
    const round = d.rounds[d.roundIndex];
    if (!round || round.resolved) return;
    round.resolved = true;
    if (round.timeoutHandle) { clearTimeout(round.timeoutHandle); round.timeoutHandle = null; }

    this.gradeRound(round);

    const score = roundWinScore(d.rounds);
    const roundNumber = d.roundIndex + 1;
    const aResult = round.outcome!.aBase === 1 ? "win" : round.outcome!.bBase === 1 ? "loss" : "draw";
    const bResult = round.outcome!.bBase === 1 ? "win" : round.outcome!.aBase === 1 ? "loss" : "draw";

    const common = {
      round: roundNumber,
      roundsTotal: ROUNDS_PER_MATCH,
      correctAnswer: round.problem.correctAnswer,
      reason: trigger,
    };

    this.emitToUser(d.a.userId, "match:roundResult", {
      ...common,
      yourScore: score.a,
      opponentScore: score.b,
      yourAnswer: round.aAnswer,
      opponentAnswer: round.bAnswer,
      youCorrect: round.aCorrect,
      opponentCorrect: round.bCorrect,
      yourTimeMs: round.aTimeMs === Infinity ? null : Math.round(round.aTimeMs),
      opponentTimeMs: round.bTimeMs === Infinity ? null : Math.round(round.bTimeMs),
      result: aResult,
    });
    this.emitToUser(d.b.userId, "match:roundResult", {
      ...common,
      yourScore: score.b,
      opponentScore: score.a,
      yourAnswer: round.bAnswer,
      opponentAnswer: round.aAnswer,
      youCorrect: round.bCorrect,
      opponentCorrect: round.aCorrect,
      yourTimeMs: round.bTimeMs === Infinity ? null : Math.round(round.bTimeMs),
      opponentTimeMs: round.aTimeMs === Infinity ? null : Math.round(round.aTimeMs),
      result: bResult,
    });

    if (d.roundIndex + 1 >= ROUNDS_PER_MATCH) {
      await this.resolveMatch(matchId, trigger);
      return;
    }

    // Advance to next round after a short pause so the client can show the
    // round-over banner.
    setTimeout(() => {
      void this.advanceRound(matchId);
    }, INTER_ROUND_DELAY_MS);
  }

  private async advanceRound(matchId: string) {
    const d = this.duels.get(matchId);
    if (!d || d.matchResolved) return;
    d.roundIndex += 1;
    const targetElo = Math.round((d.a.elo + d.b.elo) / 2);
    const excludeIds = d.rounds.map((r) => r.problem.id);
    const nextProblem =
      (await pickProblemForDuel({ mode: d.mode, targetElo, excludeIds })) ??
      (await pickProblemForDuel({ mode: d.mode, targetElo }));
    if (!nextProblem) {
      this.emitToUsers([d.a.userId, d.b.userId], "match:aborted", { reason: "no_problem" });
      this.cleanup(matchId);
      return;
    }
    d.rounds.push(newRoundRecord(nextProblem));
    this.beginRoundCountdown(matchId);
  }

  private gradeRound(round: RoundRecord) {
    const startedAt = round.startedAt ?? Date.now();
    const aSub = round.submissions.a;
    const bSub = round.submissions.b;

    const aGrade = grade({
      answerType: round.problem.answerType as "numeric" | "multiple_choice",
      submitted: aSub.rawAnswer,
      correctAnswer: round.problem.correctAnswer,
      tolerance: round.problem.tolerance ?? undefined,
      acceptableForms: round.problem.acceptableForms ? safeJsonArray(round.problem.acceptableForms) : undefined,
    });
    const bGrade = grade({
      answerType: round.problem.answerType as "numeric" | "multiple_choice",
      submitted: bSub.rawAnswer,
      correctAnswer: round.problem.correctAnswer,
      tolerance: round.problem.tolerance ?? undefined,
      acceptableForms: round.problem.acceptableForms ? safeJsonArray(round.problem.acceptableForms) : undefined,
    });

    const aTimeMs = aSub.submittedAt ? aSub.submittedAt - startedAt : Infinity;
    const bTimeMs = bSub.submittedAt ? bSub.submittedAt - startedAt : Infinity;

    round.outcome = resolveOutcome(
      { submitted: !!aSub.submittedAt, correct: aGrade.correct, accuracy: aGrade.accuracy, timeMs: aTimeMs },
      { submitted: !!bSub.submittedAt, correct: bGrade.correct, accuracy: bGrade.accuracy, timeMs: bTimeMs }
    );
    round.aTimeMs = aTimeMs;
    round.bTimeMs = bTimeMs;
    round.aAccuracy = aGrade.accuracy;
    round.bAccuracy = bGrade.accuracy;
    round.aCorrect = aGrade.correct;
    round.bCorrect = bGrade.correct;
    round.aAnswer = aSub.rawAnswer;
    round.bAnswer = bSub.rawAnswer;
  }

  private async resolveMatch(matchId: string, trigger: string) {
    const d = this.duels.get(matchId);
    if (!d || d.matchResolved) return;
    d.matchResolved = true;

    const score = roundWinScore(d.rounds);
    // Aggregate outcome — used by the existing ELO math. A match-level draw
    // means equal round wins, which includes the "both lose every round" case
    // the user asked about.
    const aggregate: RoundOutcome =
      score.a > score.b
        ? { aBase: 1, bBase: 0, bothWrong: false, reason: "match_a_wins" }
        : score.b > score.a
        ? { aBase: 0, bBase: 1, bothWrong: false, reason: "match_b_wins" }
        : { aBase: 0.5, bBase: 0.5, bothWrong: false, reason: "match_draw" };

    const avgAccA = avg(d.rounds.map((r) => r.aAccuracy));
    const avgAccB = avg(d.rounds.map((r) => r.bAccuracy));

    const { dA, dB } = computeDeltas({
      rA: d.a.elo,
      rB: d.b.elo,
      matchesA: d.a.matches,
      matchesB: d.b.matches,
      outcome: aggregate,
      accuracyA: avgAccA,
      accuracyB: avgAccB,
    });
    const newA = applyDelta(d.a.elo, dA);
    const newB = applyDelta(d.b.elo, dB);

    const winnerId =
      aggregate.aBase === 1 ? d.a.userId :
      aggregate.bBase === 1 ? d.b.userId :
      null;

    // Aggregate per-round times/accuracies for the match record. Sum of
    // accuracies divided by rounds was already computed for ELO; for the
    // match row we use the round-1 problem we already stored as the
    // representative (legacy fields), and stash totals where they fit.
    const aSumTime = d.rounds.reduce((acc, r) => acc + (r.aTimeMs === Infinity ? 0 : r.aTimeMs), 0);
    const bSumTime = d.rounds.reduce((acc, r) => acc + (r.bTimeMs === Infinity ? 0 : r.bTimeMs), 0);

    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: matchId },
        data: {
          endedAt: new Date(),
          status: "completed",
          aAnswer: d.rounds.map((r) => r.aAnswer ?? "—").join(" | "),
          bAnswer: d.rounds.map((r) => r.bAnswer ?? "—").join(" | "),
          aAccuracy: avgAccA,
          bAccuracy: avgAccB,
          aTimeMs: aSumTime ? Math.round(aSumTime) : null,
          bTimeMs: bSumTime ? Math.round(bSumTime) : null,
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

      for (const r of d.rounds) {
        await tx.problem.update({
          where: { id: r.problem.id },
          data: { timesServed: { increment: 1 } },
        });
      }
    });

    const rankA = rankChange(d.a.elo, newA);
    const rankB = rankChange(d.b.elo, newB);

    const lastRound = d.rounds[d.rounds.length - 1];
    const acceptableForms = lastRound.problem.acceptableForms ? safeJsonArray(lastRound.problem.acceptableForms) : [];

    const matchResult = (slot: "a" | "b") => {
      const win = aggregate.aBase === 1 ? "a" : aggregate.bBase === 1 ? "b" : null;
      if (win === null) return "draw";
      return win === slot ? "win" : "loss";
    };

    // Per-round breakdown delivered alongside the final result so the result
    // screen can show what happened across all 3 rounds.
    const aRoundsView = d.rounds.map((r) => ({
      problemPrompt: r.problem.prompt,
      correctAnswer: r.problem.correctAnswer,
      yourAnswer: r.aAnswer,
      opponentAnswer: r.bAnswer,
      youCorrect: r.aCorrect,
      opponentCorrect: r.bCorrect,
      yourTimeMs: r.aTimeMs === Infinity ? null : Math.round(r.aTimeMs),
      opponentTimeMs: r.bTimeMs === Infinity ? null : Math.round(r.bTimeMs),
      result: r.outcome
        ? r.outcome.aBase === 1
          ? "win"
          : r.outcome.bBase === 1
          ? "loss"
          : "draw"
        : "draw",
    }));
    const bRoundsView = d.rounds.map((r) => ({
      problemPrompt: r.problem.prompt,
      correctAnswer: r.problem.correctAnswer,
      yourAnswer: r.bAnswer,
      opponentAnswer: r.aAnswer,
      youCorrect: r.bCorrect,
      opponentCorrect: r.aCorrect,
      yourTimeMs: r.bTimeMs === Infinity ? null : Math.round(r.bTimeMs),
      opponentTimeMs: r.aTimeMs === Infinity ? null : Math.round(r.aTimeMs),
      result: r.outcome
        ? r.outcome.bBase === 1
          ? "win"
          : r.outcome.aBase === 1
          ? "loss"
          : "draw"
        : "draw",
    }));

    this.emitToUser(d.a.userId, "match:result", {
      youCorrect: lastRound.aCorrect,
      opponentCorrect: lastRound.bCorrect,
      yourAccuracy: avgAccA,
      opponentAccuracy: avgAccB,
      yourTimeMs: lastRound.aTimeMs === Infinity ? null : Math.round(lastRound.aTimeMs),
      opponentTimeMs: lastRound.bTimeMs === Infinity ? null : Math.round(lastRound.bTimeMs),
      eloDelta: dA,
      newElo: newA,
      oldRank: rankA.oldTier.name,
      newRank: rankA.newTier.name,
      rankChanged: rankA.changed,
      rankDirection: rankA.changed ? rankA.direction : null,
      correctAnswer: lastRound.problem.correctAnswer,
      acceptableForms,
      solution: lastRound.problem.solution,
      yourAnswer: lastRound.aAnswer,
      opponentAnswer: lastRound.bAnswer,
      result: matchResult("a"),
      reason: trigger,
      opponent: publicProfile(d.b),
      score: { you: score.a, opponent: score.b },
      rounds: aRoundsView,
    });

    this.emitToUser(d.b.userId, "match:result", {
      youCorrect: lastRound.bCorrect,
      opponentCorrect: lastRound.aCorrect,
      yourAccuracy: avgAccB,
      opponentAccuracy: avgAccA,
      yourTimeMs: lastRound.bTimeMs === Infinity ? null : Math.round(lastRound.bTimeMs),
      opponentTimeMs: lastRound.aTimeMs === Infinity ? null : Math.round(lastRound.aTimeMs),
      eloDelta: dB,
      newElo: newB,
      oldRank: rankB.oldTier.name,
      newRank: rankB.newTier.name,
      rankChanged: rankB.changed,
      rankDirection: rankB.changed ? rankB.direction : null,
      correctAnswer: lastRound.problem.correctAnswer,
      acceptableForms,
      solution: lastRound.problem.solution,
      yourAnswer: lastRound.bAnswer,
      opponentAnswer: lastRound.aAnswer,
      result: matchResult("b"),
      reason: trigger,
      opponent: publicProfile(d.a),
      score: { you: score.b, opponent: score.a },
      rounds: bRoundsView,
    });

    this.cleanup(matchId);
  }

  private cleanup(matchId: string) {
    const d = this.duels.get(matchId);
    if (!d) return;
    for (const r of d.rounds) {
      if (r.timeoutHandle) clearTimeout(r.timeoutHandle);
    }
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

function newRoundRecord(problem: Problem): RoundRecord {
  return {
    problem,
    startedAt: null,
    submissions: { a: { rawAnswer: null, submittedAt: null }, b: { rawAnswer: null, submittedAt: null } },
    outcome: null,
    aTimeMs: Infinity,
    bTimeMs: Infinity,
    aAccuracy: 0,
    bAccuracy: 0,
    aCorrect: false,
    bCorrect: false,
    aAnswer: null,
    bAnswer: null,
    timeoutHandle: null,
    resolved: false,
  };
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

function avg(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

void ELO_CONFIG;
