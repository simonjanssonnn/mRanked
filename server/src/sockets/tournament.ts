// Tournament mode: single-elimination bracket built on the same join-code +
// in-memory pattern as LobbyManager. Bracket size is fixed at 4/8/16; if
// fewer players actually start, the missing slots become byes.
//
// Match flow is serial — only one match at a time, everyone else watches.
// Inside a match, both players see the same problem and the first correct
// answer wins that game (ties = both wrong = draw, replay). Best-of-N
// (N = 1/3/5) decides the match.

import type { Server } from "socket.io";
import type { Problem } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { grade } from "../lib/grading.js";

const MAX_PLAYERS = 16;
const JOIN_CODE_LEN = 6;
const TOURNAMENT_TTL_MS = 1000 * 60 * 60; // 1h idle cleanup
const COUNTDOWN_SECONDS = 3;
const BETWEEN_GAMES_MS = 3500;
const BETWEEN_MATCHES_MS = 4000;

export type TournamentSettings = {
  bracketSize: 4 | 8 | 16;
  bestOf: 1 | 3 | 5;       // games per match
  timeLimitSec: number;    // 15..7200
  tiers: string[];
  categories: string[];
};

const DEFAULT_SETTINGS: TournamentSettings = {
  bracketSize: 4,
  bestOf: 3,
  timeLimitSec: 45,
  tiers: ["Bronze", "Silver", "Gold"],
  categories: [],
};

type TournamentPlayer = {
  userId: string;
  username: string;
  socketId: string | null;
  avatarColor: string;
  avatarInitials: string;
  avatarImage: string;
  equippedTitle: string;
  // Per-current-game state, reset each game:
  submittedAt: number | null;
  answer: string | null;
  correct: boolean;
};

// One slot in the bracket. `playerId` is null for byes or for upcoming nodes
// whose parents haven't decided yet.
type BracketSlot = { playerId: string | null; bye: boolean };

type BracketMatch = {
  id: string;
  round: number;          // 1 = first round
  index: number;          // position within the round (0..)
  a: BracketSlot;
  b: BracketSlot;
  winsA: number;
  winsB: number;
  winnerId: string | null;
  played: boolean;
};

type TournamentState =
  | "waiting"
  | "match_intro"
  | "in_game"
  | "between_games"
  | "match_over"
  | "complete";

type Tournament = {
  code: string;
  hostId: string;
  settings: TournamentSettings;
  players: Map<string, TournamentPlayer>;
  state: TournamentState;
  bracket: BracketMatch[];
  currentMatchId: string | null;
  currentGame: number;          // 1..bestOf
  currentProblem: Problem | null;
  gameStartedAt: number | null;
  gameTimeoutHandle: NodeJS.Timeout | null;
  betweenTimeoutHandle: NodeJS.Timeout | null;
  problemsServed: string[];
  champion: string | null;
  createdAt: number;
  lastActivity: number;
};

function gen6CharCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < JOIN_CODE_LEN; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function publicPlayer(p: TournamentPlayer) {
  return {
    userId: p.userId,
    username: p.username,
    avatarColor: p.avatarColor,
    avatarInitials: p.avatarInitials,
    avatarImage: p.avatarImage,
    equippedTitle: p.equippedTitle,
    submitted: p.submittedAt !== null,
    connected: p.socketId !== null,
  };
}

function publicMatch(m: BracketMatch) {
  return {
    id: m.id,
    round: m.round,
    index: m.index,
    aId: m.a.playerId,
    bId: m.b.playerId,
    aBye: m.a.bye,
    bBye: m.b.bye,
    winsA: m.winsA,
    winsB: m.winsB,
    winnerId: m.winnerId,
    played: m.played,
  };
}

function publicTournament(t: Tournament) {
  return {
    code: t.code,
    hostId: t.hostId,
    settings: t.settings,
    state: t.state,
    bracket: t.bracket.map(publicMatch),
    currentMatchId: t.currentMatchId,
    currentGame: t.currentGame,
    bestOf: t.settings.bestOf,
    bracketSize: t.settings.bracketSize,
    champion: t.champion,
    players: Array.from(t.players.values()).map(publicPlayer),
  };
}

export class TournamentManager {
  private tournaments = new Map<string, Tournament>();
  private userToTournament = new Map<string, string>();
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    setInterval(() => this.cleanupStale(), 60_000);
  }

  tournamentForUser(userId: string): Tournament | null {
    const code = this.userToTournament.get(userId);
    return code ? this.tournaments.get(code) ?? null : null;
  }

  async create(args: { host: TournamentPlayer; settings?: Partial<TournamentSettings> }): Promise<Tournament> {
    this.leave(args.host.userId);

    let code = gen6CharCode();
    while (this.tournaments.has(code)) code = gen6CharCode();

    const merged: TournamentSettings = { ...DEFAULT_SETTINGS, ...args.settings };
    if (merged.bracketSize !== 4 && merged.bracketSize !== 8 && merged.bracketSize !== 16) merged.bracketSize = 4;
    if (merged.bestOf !== 1 && merged.bestOf !== 3 && merged.bestOf !== 5) merged.bestOf = 3;
    merged.timeLimitSec = Math.max(15, Math.min(7200, Math.floor(merged.timeLimitSec)));

    const t: Tournament = {
      code,
      hostId: args.host.userId,
      settings: merged,
      players: new Map([[args.host.userId, args.host]]),
      state: "waiting",
      bracket: [],
      currentMatchId: null,
      currentGame: 0,
      currentProblem: null,
      gameStartedAt: null,
      gameTimeoutHandle: null,
      betweenTimeoutHandle: null,
      problemsServed: [],
      champion: null,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    this.tournaments.set(code, t);
    this.userToTournament.set(args.host.userId, code);
    if (args.host.socketId) {
      this.io.sockets.sockets.get(args.host.socketId)?.join(`tournament:${code}`);
    }
    this.broadcastState(t);
    return t;
  }

  join(code: string, player: TournamentPlayer): { ok: true; tournament: Tournament } | { ok: false; reason: string } {
    const t = this.tournaments.get(code.toUpperCase());
    if (!t) return { ok: false, reason: "no_such_tournament" };
    if (t.state !== "waiting") return { ok: false, reason: "in_progress" };
    if (t.players.size >= Math.min(MAX_PLAYERS, t.settings.bracketSize) && !t.players.has(player.userId)) {
      return { ok: false, reason: "tournament_full" };
    }
    if (this.userToTournament.get(player.userId) && this.userToTournament.get(player.userId) !== t.code) {
      this.leave(player.userId);
    }
    t.players.set(player.userId, { ...player, submittedAt: null, answer: null, correct: false });
    this.userToTournament.set(player.userId, t.code);
    if (player.socketId) {
      this.io.sockets.sockets.get(player.socketId)?.join(`tournament:${t.code}`);
    }
    t.lastActivity = Date.now();
    this.broadcastState(t);
    return { ok: true, tournament: t };
  }

  leave(userId: string): void {
    const code = this.userToTournament.get(userId);
    if (!code) return;
    const t = this.tournaments.get(code);
    this.userToTournament.delete(userId);
    if (!t) return;
    const p = t.players.get(userId);
    if (p?.socketId) {
      this.io.sockets.sockets.get(p.socketId)?.leave(`tournament:${code}`);
    }
    // Only fully remove from players map while in waiting state. Once the
    // bracket is running we want the username/avatar to still resolve when
    // rendering past matches; mark them disconnected instead. A still-alive
    // bracket participant who disappears forfeits their current/upcoming match.
    if (t.state === "waiting") {
      t.players.delete(userId);
    } else {
      if (p) p.socketId = null;
      this.handleBracketForfeit(t, userId);
    }
    t.lastActivity = Date.now();

    const anyConnected = Array.from(t.players.values()).some((q) => q.socketId !== null);
    if (!anyConnected) {
      if (t.gameTimeoutHandle) clearTimeout(t.gameTimeoutHandle);
      if (t.betweenTimeoutHandle) clearTimeout(t.betweenTimeoutHandle);
      this.tournaments.delete(t.code);
      return;
    }
    if (t.hostId === userId) {
      const next = Array.from(t.players.values()).find((q) => q.socketId !== null);
      if (next) t.hostId = next.userId;
    }
    this.broadcastState(t);
  }

  updateSettings(userId: string, patch: Partial<TournamentSettings>): void {
    const t = this.tournamentForUser(userId);
    if (!t || t.hostId !== userId || t.state !== "waiting") return;
    if (patch.bracketSize === 4 || patch.bracketSize === 8 || patch.bracketSize === 16) {
      t.settings.bracketSize = patch.bracketSize;
    }
    if (patch.bestOf === 1 || patch.bestOf === 3 || patch.bestOf === 5) {
      t.settings.bestOf = patch.bestOf;
    }
    if (typeof patch.timeLimitSec === "number") {
      t.settings.timeLimitSec = Math.max(15, Math.min(7200, Math.floor(patch.timeLimitSec)));
    }
    if (Array.isArray(patch.tiers)) t.settings.tiers = patch.tiers.slice(0, 20).map(String);
    if (Array.isArray(patch.categories)) t.settings.categories = patch.categories.slice(0, 20).map(String);
    t.lastActivity = Date.now();
    this.broadcastState(t);
  }

  async start(userId: string): Promise<void> {
    const t = this.tournamentForUser(userId);
    if (!t) {
      this.emitToUser(userId, "tournament:error", { code: "no_tournament", message: "You're not in a tournament." });
      return;
    }
    if (t.hostId !== userId) {
      this.emitToUser(userId, "tournament:error", { code: "not_host", message: "Only the host can start the bracket." });
      return;
    }
    if (t.state !== "waiting") {
      this.emitToUser(userId, "tournament:error", { code: "bad_state", message: `Can't start while in ${t.state}.` });
      return;
    }
    if (t.players.size < 2) {
      this.emitToTournament(t, "tournament:error", { code: "need_two_players", message: "Need at least 2 players to start." });
      return;
    }

    this.buildBracket(t);
    t.champion = null;
    t.lastActivity = Date.now();
    await this.advanceToNextMatch(t);
  }

  async handleAnswer(userId: string, answer: string): Promise<void> {
    const t = this.tournamentForUser(userId);
    if (!t || t.state !== "in_game" || !t.currentProblem || !t.currentMatchId) return;
    const match = t.bracket.find((m) => m.id === t.currentMatchId);
    if (!match) return;
    // Only the two active match players can submit.
    if (match.a.playerId !== userId && match.b.playerId !== userId) return;
    const p = t.players.get(userId);
    if (!p || p.submittedAt !== null) return;

    p.submittedAt = Date.now();
    p.answer = typeof answer === "string" ? answer.slice(0, 500) : "";
    const g = grade({
      answerType: t.currentProblem.answerType as "numeric" | "multiple_choice",
      submitted: p.answer,
      correctAnswer: t.currentProblem.correctAnswer,
      tolerance: t.currentProblem.tolerance ?? undefined,
      acceptableForms: t.currentProblem.acceptableForms ? safeJsonArray(t.currentProblem.acceptableForms) : undefined,
    });
    p.correct = g.correct;

    this.emitToTournament(t, "tournament:player_submitted", { userId: p.userId });

    // First correct answer wins the game outright.
    if (p.correct) {
      if (t.gameTimeoutHandle) clearTimeout(t.gameTimeoutHandle);
      this.endGame(t);
      return;
    }
    // Both submitted, neither correct = draw, replay.
    const a = match.a.playerId ? t.players.get(match.a.playerId) ?? null : null;
    const b = match.b.playerId ? t.players.get(match.b.playerId) ?? null : null;
    if (a && b && a.submittedAt !== null && b.submittedAt !== null) {
      if (t.gameTimeoutHandle) clearTimeout(t.gameTimeoutHandle);
      this.endGame(t);
    }
  }

  handleDisconnect(userId: string): void {
    const t = this.tournamentForUser(userId);
    if (!t) return;
    const p = t.players.get(userId);
    if (!p) return;
    p.socketId = null;
    this.broadcastState(t);
  }

  handleReconnect(userId: string, socketId: string): void {
    const t = this.tournamentForUser(userId);
    if (!t) return;
    const p = t.players.get(userId);
    if (!p) return;
    p.socketId = socketId;
    this.io.sockets.sockets.get(socketId)?.join(`tournament:${t.code}`);
    const sock = this.io.sockets.sockets.get(socketId);
    if (!sock) return;
    sock.emit("tournament:state", publicTournament(t));
    if (t.state === "in_game" && t.currentProblem && t.gameStartedAt) {
      sock.emit("tournament:game_started", {
        matchId: t.currentMatchId,
        game: t.currentGame,
        bestOf: t.settings.bestOf,
        problem: this.publicProblem(t.currentProblem),
        gameStartedAt: t.gameStartedAt,
      });
    }
  }

  // ──────── bracket internals ────────

  private buildBracket(t: Tournament): void {
    const size = t.settings.bracketSize;
    const seeded = shuffle(Array.from(t.players.keys())).slice(0, size);
    // Pad to bracket size with byes (null player IDs marked bye).
    const slots: BracketSlot[] = [];
    for (let i = 0; i < size; i++) {
      slots.push(seeded[i] ? { playerId: seeded[i], bye: false } : { playerId: null, bye: true });
    }

    const totalRounds = Math.log2(size); // 2 -> 1, 4 -> 2, 8 -> 3, 16 -> 4
    const bracket: BracketMatch[] = [];

    // Round 1.
    let nextRoundSlots: BracketSlot[] = [];
    for (let i = 0; i < size; i += 2) {
      const a = slots[i];
      const b = slots[i + 1];
      const match: BracketMatch = {
        id: `r1m${i / 2}`,
        round: 1,
        index: i / 2,
        a,
        b,
        winsA: 0,
        winsB: 0,
        winnerId: null,
        played: false,
      };
      // Auto-resolve byes: if exactly one of the two is a bye, the other
      // advances. If both are byes, the slot is empty going forward.
      if (a.bye && !b.bye) {
        match.winnerId = b.playerId;
        match.played = true;
        nextRoundSlots.push({ playerId: b.playerId, bye: false });
      } else if (!a.bye && b.bye) {
        match.winnerId = a.playerId;
        match.played = true;
        nextRoundSlots.push({ playerId: a.playerId, bye: false });
      } else if (a.bye && b.bye) {
        match.played = true;
        nextRoundSlots.push({ playerId: null, bye: true });
      } else {
        nextRoundSlots.push({ playerId: null, bye: false });
      }
      bracket.push(match);
    }

    // Subsequent rounds — slots filled in dynamically as winners decide.
    for (let r = 2; r <= totalRounds; r++) {
      const count = size / Math.pow(2, r);
      const newNext: BracketSlot[] = [];
      for (let i = 0; i < count; i++) {
        // The parent matches at round r-1 for this slot are at indices 2i, 2i+1.
        // If both parents auto-resolved to byes already, propagate the bye.
        const parent1 = bracket.find((m) => m.round === r - 1 && m.index === 2 * i);
        const parent2 = bracket.find((m) => m.round === r - 1 && m.index === 2 * i + 1);
        const aSeed: BracketSlot = parent1?.played && parent1.winnerId === null
          ? { playerId: null, bye: true }
          : parent1?.winnerId
            ? { playerId: parent1.winnerId, bye: false }
            : { playerId: null, bye: false };
        const bSeed: BracketSlot = parent2?.played && parent2.winnerId === null
          ? { playerId: null, bye: true }
          : parent2?.winnerId
            ? { playerId: parent2.winnerId, bye: false }
            : { playerId: null, bye: false };

        const match: BracketMatch = {
          id: `r${r}m${i}`,
          round: r,
          index: i,
          a: aSeed,
          b: bSeed,
          winsA: 0,
          winsB: 0,
          winnerId: null,
          played: false,
        };
        // Auto-resolve cascading byes.
        if (aSeed.bye && !bSeed.bye && bSeed.playerId) {
          match.winnerId = bSeed.playerId;
          match.played = true;
          newNext.push({ playerId: bSeed.playerId, bye: false });
        } else if (!aSeed.bye && bSeed.bye && aSeed.playerId) {
          match.winnerId = aSeed.playerId;
          match.played = true;
          newNext.push({ playerId: aSeed.playerId, bye: false });
        } else if (aSeed.bye && bSeed.bye) {
          match.played = true;
          newNext.push({ playerId: null, bye: true });
        } else {
          newNext.push({ playerId: null, bye: false });
        }
        bracket.push(match);
      }
      nextRoundSlots = newNext;
    }

    t.bracket = bracket;
  }

  private async advanceToNextMatch(t: Tournament): Promise<void> {
    if (t.betweenTimeoutHandle) { clearTimeout(t.betweenTimeoutHandle); t.betweenTimeoutHandle = null; }

    // Reset per-game state on all players (cheap, keeps things clean).
    for (const p of t.players.values()) {
      p.submittedAt = null;
      p.answer = null;
      p.correct = false;
    }

    // Find the next unplayed match with two real players. Resolve any pending
    // bye / forfeit propagations along the way.
    const next = this.findNextPlayableMatch(t);
    if (!next) {
      // No more matches: tournament complete. Champion is the winner of the
      // last (highest-round) decided match, if any.
      const finalRound = Math.max(...t.bracket.map((m) => m.round));
      const finalMatch = t.bracket.find((m) => m.round === finalRound);
      t.champion = finalMatch?.winnerId ?? null;
      t.state = "complete";
      t.currentMatchId = null;
      t.currentProblem = null;
      t.currentGame = 0;
      t.gameStartedAt = null;
      this.broadcastState(t);
      this.emitToTournament(t, "tournament:complete", {
        championId: t.champion,
        bracket: t.bracket.map(publicMatch),
      });
      // Return to waiting state after a short delay so host can rebuild.
      setTimeout(() => {
        t.state = "waiting";
        t.bracket = [];
        t.champion = null;
        this.broadcastState(t);
      }, 20_000);
      return;
    }

    t.currentMatchId = next.id;
    t.currentGame = 0;
    t.state = "match_intro";
    this.broadcastState(t);

    // Brief delay so clients can show the "who's up next" intro card.
    t.betweenTimeoutHandle = setTimeout(() => {
      void this.advanceToNextGame(t);
    }, BETWEEN_MATCHES_MS);
  }

  // Walks the bracket and resolves any matches that should auto-resolve
  // (one or both players became byes via earlier forfeits). Returns the next
  // match where both players actually need to play.
  private findNextPlayableMatch(t: Tournament): BracketMatch | null {
    // Sort by round, then index — natural play order.
    const ordered = t.bracket.slice().sort((a, b) => a.round - b.round || a.index - b.index);
    for (const m of ordered) {
      if (m.played) continue;
      // Refresh slots from parent winners in case those got decided after build.
      this.refreshSlotsFromParents(t, m);
      if (m.a.bye && m.b.bye) {
        m.played = true;
        m.winnerId = null;
        this.propagateWinner(t, m);
        continue;
      }
      if (m.a.bye && m.b.playerId) {
        m.played = true;
        m.winnerId = m.b.playerId;
        this.propagateWinner(t, m);
        continue;
      }
      if (m.b.bye && m.a.playerId) {
        m.played = true;
        m.winnerId = m.a.playerId;
        this.propagateWinner(t, m);
        continue;
      }
      if (m.a.playerId && m.b.playerId) return m;
      // Slot not yet filled (parent not played). Stop and wait.
      return null;
    }
    return null;
  }

  private refreshSlotsFromParents(t: Tournament, m: BracketMatch): void {
    if (m.round === 1) return;
    const parentA = t.bracket.find((x) => x.round === m.round - 1 && x.index === 2 * m.index);
    const parentB = t.bracket.find((x) => x.round === m.round - 1 && x.index === 2 * m.index + 1);
    if (parentA?.played) {
      m.a = parentA.winnerId
        ? { playerId: parentA.winnerId, bye: false }
        : { playerId: null, bye: true };
    }
    if (parentB?.played) {
      m.b = parentB.winnerId
        ? { playerId: parentB.winnerId, bye: false }
        : { playerId: null, bye: true };
    }
  }

  private propagateWinner(t: Tournament, m: BracketMatch): void {
    const child = t.bracket.find((x) => x.round === m.round + 1 && x.index === Math.floor(m.index / 2));
    if (!child) return;
    const slot: BracketSlot = m.winnerId
      ? { playerId: m.winnerId, bye: false }
      : { playerId: null, bye: true };
    if (m.index % 2 === 0) child.a = slot;
    else child.b = slot;
  }

  private async advanceToNextGame(t: Tournament): Promise<void> {
    const match = t.bracket.find((m) => m.id === t.currentMatchId);
    if (!match) return;

    const needToWin = Math.ceil(t.settings.bestOf / 2);
    if (match.winsA >= needToWin || match.winsB >= needToWin) {
      // Match decided.
      match.played = true;
      match.winnerId = match.winsA > match.winsB ? match.a.playerId : match.b.playerId;
      this.propagateWinner(t, match);
      t.state = "match_over";
      this.broadcastState(t);
      this.emitToTournament(t, "tournament:match_over", {
        matchId: match.id,
        winnerId: match.winnerId,
        winsA: match.winsA,
        winsB: match.winsB,
      });
      t.betweenTimeoutHandle = setTimeout(() => {
        void this.advanceToNextMatch(t);
      }, BETWEEN_MATCHES_MS);
      return;
    }

    t.currentGame += 1;
    for (const p of t.players.values()) {
      p.submittedAt = null;
      p.answer = null;
      p.correct = false;
    }

    const problem = await this.pickProblem(t);
    if (!problem) {
      this.emitToTournament(t, "tournament:error", {
        code: "no_problem",
        message: "No problems match the chosen tiers/categories. Adjust settings and start a new tournament.",
      });
      // Bail back to waiting so the host can fix things.
      if (t.gameTimeoutHandle) clearTimeout(t.gameTimeoutHandle);
      if (t.betweenTimeoutHandle) clearTimeout(t.betweenTimeoutHandle);
      t.state = "waiting";
      t.bracket = [];
      t.currentMatchId = null;
      t.currentProblem = null;
      t.gameStartedAt = null;
      this.broadcastState(t);
      return;
    }
    t.currentProblem = problem;
    t.problemsServed.push(problem.id);
    t.state = "in_game";
    t.gameStartedAt = null;
    this.broadcastState(t);

    this.emitToTournament(t, "tournament:game_starting", {
      matchId: match.id,
      game: t.currentGame,
      bestOf: t.settings.bestOf,
    });

    for (let s = COUNTDOWN_SECONDS; s >= 1; s--) {
      const secondsLeft = s;
      setTimeout(() => {
        if (t.state !== "in_game") return;
        this.emitToTournament(t, "tournament:countdown", { secondsLeft });
      }, (COUNTDOWN_SECONDS - s) * 1000);
    }
    setTimeout(() => {
      if (t.state !== "in_game") return;
      t.gameStartedAt = Date.now();
      this.broadcastState(t);
      this.emitToTournament(t, "tournament:game_started", {
        matchId: match.id,
        game: t.currentGame,
        bestOf: t.settings.bestOf,
        problem: this.publicProblem(problem),
        gameStartedAt: t.gameStartedAt,
      });
      t.gameTimeoutHandle = setTimeout(() => this.endGame(t), t.settings.timeLimitSec * 1000);
    }, COUNTDOWN_SECONDS * 1000);
  }

  private endGame(t: Tournament): void {
    if (t.state !== "in_game" || !t.currentProblem || !t.currentMatchId) return;
    const match = t.bracket.find((m) => m.id === t.currentMatchId);
    if (!match) return;

    const aId = match.a.playerId;
    const bId = match.b.playerId;
    const a = aId ? t.players.get(aId) ?? null : null;
    const b = bId ? t.players.get(bId) ?? null : null;

    // Decide game winner: first correct submission. If both submitted correct
    // (shouldn't normally happen — we short-circuit on first correct), the
    // earlier submission wins. If neither correct, it's a draw — replay
    // without changing the match score.
    let gameWinnerId: string | null = null;
    if (a?.correct && b?.correct) {
      const tA = a.submittedAt ?? Number.MAX_SAFE_INTEGER;
      const tB = b.submittedAt ?? Number.MAX_SAFE_INTEGER;
      gameWinnerId = tA <= tB ? aId : bId;
    } else if (a?.correct) gameWinnerId = aId;
    else if (b?.correct) gameWinnerId = bId;

    if (gameWinnerId === aId && aId) match.winsA += 1;
    else if (gameWinnerId === bId && bId) match.winsB += 1;

    t.state = "between_games";
    if (t.gameTimeoutHandle) { clearTimeout(t.gameTimeoutHandle); t.gameTimeoutHandle = null; }

    this.emitToTournament(t, "tournament:game_ended", {
      matchId: match.id,
      game: t.currentGame,
      gameWinnerId,
      winsA: match.winsA,
      winsB: match.winsB,
      correctAnswer: t.currentProblem.correctAnswer,
      solution: t.currentProblem.solution,
      a: a ? { userId: a.userId, answer: a.answer, correct: a.correct, timeMs: a.submittedAt && t.gameStartedAt ? a.submittedAt - t.gameStartedAt : null } : null,
      b: b ? { userId: b.userId, answer: b.answer, correct: b.correct, timeMs: b.submittedAt && t.gameStartedAt ? b.submittedAt - t.gameStartedAt : null } : null,
    });
    this.broadcastState(t);

    t.betweenTimeoutHandle = setTimeout(() => {
      void this.advanceToNextGame(t);
    }, BETWEEN_GAMES_MS);
  }

  // A live bracket participant left mid-tournament. If they're in an upcoming
  // or currently-running match, they forfeit and the opponent advances. If
  // they were the only player remaining in a match (e.g. both went bye), the
  // slot becomes a bye.
  private handleBracketForfeit(t: Tournament, userId: string): void {
    // Find any matches involving this player that aren't decided.
    for (const m of t.bracket) {
      if (m.played) continue;
      const isA = m.a.playerId === userId;
      const isB = m.b.playerId === userId;
      if (!isA && !isB) continue;
      // If this is the live match, end it now with the opponent winning.
      if (t.currentMatchId === m.id && t.state !== "waiting") {
        const oppId = isA ? m.b.playerId : m.a.playerId;
        m.winnerId = oppId;
        m.played = true;
        m.winsA = isA ? 0 : Math.ceil(t.settings.bestOf / 2);
        m.winsB = isB ? 0 : Math.ceil(t.settings.bestOf / 2);
        this.propagateWinner(t, m);
        if (t.gameTimeoutHandle) clearTimeout(t.gameTimeoutHandle);
        if (t.betweenTimeoutHandle) clearTimeout(t.betweenTimeoutHandle);
        t.state = "match_over";
        this.emitToTournament(t, "tournament:match_over", {
          matchId: m.id,
          winnerId: oppId,
          winsA: m.winsA,
          winsB: m.winsB,
          reason: "forfeit",
        });
        t.betweenTimeoutHandle = setTimeout(() => { void this.advanceToNextMatch(t); }, BETWEEN_MATCHES_MS);
      } else {
        // Future match — convert their slot to a bye.
        if (isA) m.a = { playerId: null, bye: true };
        else m.b = { playerId: null, bye: true };
      }
    }
  }

  private async pickProblem(t: Tournament): Promise<Problem | null> {
    const tiers = t.settings.tiers.length ? t.settings.tiers : null;
    const cats = t.settings.categories.length ? t.settings.categories : null;
    const candidates = await prisma.problem.findMany({
      where: {
        mode: "classic",
        id: t.problemsServed.length ? { notIn: t.problemsServed } : undefined,
        ...(tiers && { tier: { in: tiers } }),
        ...(cats && { category: { in: cats } }),
      },
      take: 100,
    });
    if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
    const fallback = await prisma.problem.findMany({
      where: {
        mode: "classic",
        ...(tiers && { tier: { in: tiers } }),
        ...(cats && { category: { in: cats } }),
      },
      take: 100,
    });
    if (fallback.length) return fallback[Math.floor(Math.random() * fallback.length)];
    return null;
  }

  private publicProblem(problem: Problem) {
    return {
      id: problem.id,
      prompt: problem.prompt,
      answerType: problem.answerType,
      options: problem.options ? safeJsonArray(problem.options) : undefined,
      timeLimitSec: problem.timeLimitSeconds,
      calculatorAllowed: problem.calculatorAllowed,
      tier: problem.tier,
    };
  }

  private broadcastState(t: Tournament) {
    this.emitToTournament(t, "tournament:state", publicTournament(t));
  }

  private emitToTournament(t: Tournament, event: string, payload: unknown) {
    this.io.to(`tournament:${t.code}`).emit(event, payload);
  }

  private emitToUser(userId: string, event: string, payload: unknown) {
    for (const [, socket] of this.io.sockets.sockets) {
      if ((socket.data as { userId?: string }).userId === userId) {
        socket.emit(event, payload);
      }
    }
  }

  private cleanupStale() {
    const now = Date.now();
    for (const t of this.tournaments.values()) {
      if (now - t.lastActivity > TOURNAMENT_TTL_MS) {
        if (t.gameTimeoutHandle) clearTimeout(t.gameTimeoutHandle);
        if (t.betweenTimeoutHandle) clearTimeout(t.betweenTimeoutHandle);
        for (const userId of t.players.keys()) this.userToTournament.delete(userId);
        this.tournaments.delete(t.code);
      }
    }
  }
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
