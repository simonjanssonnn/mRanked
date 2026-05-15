// Custom lobby: free-for-all math duels with a host-configured ruleset.
// In-memory only — lobbies are ephemeral and don't survive a server restart.
// No ELO impact; this is the "play with friends" mode.

import type { Server } from "socket.io";
import { prisma } from "../lib/db.js";
import { pickProblemForDuel } from "../services/problems.js";
import { grade } from "../lib/grading.js";

const MAX_PLAYERS = 10;
const COUNTDOWN_SECONDS = 3;
const BETWEEN_ROUND_MS = 4000;
const JOIN_CODE_LEN = 6;
const LOBBY_TTL_MS = 1000 * 60 * 60; // 1h idle cleanup

// Points awarded by finishing position for a round (correct answers only).
// Anyone wrong gets 0 regardless of speed.
const POINTS_BY_PLACE = [10, 8, 6, 5, 4, 3, 2, 1, 1, 1];

export type LobbySettings = {
  rounds: number;          // 1..15
  timeLimitSec: number;    // 15..180
  tiers: string[];         // ["Initiate", "Bronze", ...] — empty = all
  categories: string[];    // ["algebra", ...] — empty = all
};

const DEFAULT_SETTINGS: LobbySettings = {
  rounds: 5,
  timeLimitSec: 45,
  tiers: ["Bronze", "Silver", "Gold"],
  categories: [],
};

type LobbyPlayer = {
  userId: string;
  username: string;
  socketId: string | null;
  avatarColor: string;
  avatarInitials: string;
  avatarImage: string;
  equippedTitle: string;
  score: number;
  // Per-round, reset each round.
  submittedAt: number | null;
  answer: string | null;
  correct: boolean;
};

type Problem = NonNullable<Awaited<ReturnType<typeof pickProblemForDuel>>>;

type LobbyState = "waiting" | "in_round" | "between_rounds" | "complete";

type Lobby = {
  code: string;
  hostId: string;
  settings: LobbySettings;
  players: Map<string, LobbyPlayer>;
  state: LobbyState;
  round: number;
  currentProblem: Problem | null;
  roundStartedAt: number | null;
  roundTimeoutHandle: NodeJS.Timeout | null;
  betweenTimeoutHandle: NodeJS.Timeout | null;
  problemsServed: string[];
  createdAt: number;
  lastActivity: number;
};

function gen6CharCode(): string {
  // Ambiguous chars (0/O, 1/I/L) omitted for human-readable codes.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < JOIN_CODE_LEN; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function publicPlayer(p: LobbyPlayer) {
  return {
    userId: p.userId,
    username: p.username,
    avatarColor: p.avatarColor,
    avatarInitials: p.avatarInitials,
    avatarImage: p.avatarImage,
    equippedTitle: p.equippedTitle,
    score: p.score,
    submitted: p.submittedAt !== null,
    connected: p.socketId !== null,
  };
}

function publicLobby(lobby: Lobby) {
  return {
    code: lobby.code,
    hostId: lobby.hostId,
    settings: lobby.settings,
    state: lobby.state,
    round: lobby.round,
    rounds: lobby.settings.rounds,
    players: Array.from(lobby.players.values()).map(publicPlayer),
  };
}

export class LobbyManager {
  private lobbies = new Map<string, Lobby>();
  private userToLobby = new Map<string, string>();
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    // Periodic cleanup of stale lobbies.
    setInterval(() => this.cleanupStaleLobbies(), 60_000);
  }

  lobbyForUser(userId: string): Lobby | null {
    const code = this.userToLobby.get(userId);
    return code ? this.lobbies.get(code) ?? null : null;
  }

  async create(args: {
    host: LobbyPlayer;
    settings?: Partial<LobbySettings>;
  }): Promise<Lobby> {
    // If the user is already in a lobby, kick them out first.
    this.leave(args.host.userId);

    let code = gen6CharCode();
    while (this.lobbies.has(code)) code = gen6CharCode();

    const lobby: Lobby = {
      code,
      hostId: args.host.userId,
      settings: { ...DEFAULT_SETTINGS, ...args.settings },
      players: new Map([[args.host.userId, args.host]]),
      state: "waiting",
      round: 0,
      currentProblem: null,
      roundStartedAt: null,
      roundTimeoutHandle: null,
      betweenTimeoutHandle: null,
      problemsServed: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    this.lobbies.set(code, lobby);
    this.userToLobby.set(args.host.userId, code);
    if (args.host.socketId) {
      this.io.sockets.sockets.get(args.host.socketId)?.join(`lobby:${code}`);
    }
    this.broadcastState(lobby);
    return lobby;
  }

  join(code: string, player: LobbyPlayer): { ok: true; lobby: Lobby } | { ok: false; reason: string } {
    const lobby = this.lobbies.get(code.toUpperCase());
    if (!lobby) return { ok: false, reason: "no_such_lobby" };
    if (lobby.state !== "waiting") return { ok: false, reason: "in_progress" };
    if (lobby.players.size >= MAX_PLAYERS && !lobby.players.has(player.userId)) {
      return { ok: false, reason: "lobby_full" };
    }

    // If they're in another lobby, leave it first.
    if (this.userToLobby.get(player.userId) && this.userToLobby.get(player.userId) !== lobby.code) {
      this.leave(player.userId);
    }

    lobby.players.set(player.userId, { ...player, score: 0, submittedAt: null, answer: null, correct: false });
    this.userToLobby.set(player.userId, lobby.code);
    if (player.socketId) {
      this.io.sockets.sockets.get(player.socketId)?.join(`lobby:${lobby.code}`);
    }
    lobby.lastActivity = Date.now();
    this.broadcastState(lobby);
    return { ok: true, lobby };
  }

  leave(userId: string): void {
    const code = this.userToLobby.get(userId);
    if (!code) return;
    const lobby = this.lobbies.get(code);
    this.userToLobby.delete(userId);
    if (!lobby) return;

    const p = lobby.players.get(userId);
    if (p?.socketId) {
      this.io.sockets.sockets.get(p.socketId)?.leave(`lobby:${code}`);
    }
    lobby.players.delete(userId);
    lobby.lastActivity = Date.now();

    // Host transfer or lobby tear-down.
    if (lobby.players.size === 0) {
      if (lobby.roundTimeoutHandle) clearTimeout(lobby.roundTimeoutHandle);
      if (lobby.betweenTimeoutHandle) clearTimeout(lobby.betweenTimeoutHandle);
      this.lobbies.delete(code);
      return;
    }
    if (lobby.hostId === userId) {
      // Promote the first remaining player as new host.
      lobby.hostId = Array.from(lobby.players.keys())[0];
    }
    this.broadcastState(lobby);
  }

  updateSettings(userId: string, patch: Partial<LobbySettings>): void {
    const lobby = this.lobbyForUser(userId);
    if (!lobby || lobby.hostId !== userId || lobby.state !== "waiting") return;
    lobby.settings = { ...lobby.settings, ...patch };
    // Clamp to sane ranges. Max 2 hours per round — Olympiad-tier problems
    // genuinely need that long; anything beyond would just be a memory leak.
    lobby.settings.rounds = Math.max(1, Math.min(15, Math.floor(lobby.settings.rounds)));
    lobby.settings.timeLimitSec = Math.max(15, Math.min(7200, Math.floor(lobby.settings.timeLimitSec)));
    lobby.lastActivity = Date.now();
    this.broadcastState(lobby);
  }

  async start(userId: string): Promise<void> {
    const lobby = this.lobbyForUser(userId);
    if (!lobby || lobby.hostId !== userId || lobby.state !== "waiting") return;
    if (lobby.players.size < 2) {
      this.emitToLobby(lobby, "lobby:error", { code: "need_two_players", message: "Need at least 2 players to start." });
      return;
    }
    lobby.round = 0;
    for (const p of lobby.players.values()) p.score = 0;
    lobby.lastActivity = Date.now();
    await this.advanceRound(lobby);
  }

  async handleAnswer(userId: string, answer: string): Promise<void> {
    const lobby = this.lobbyForUser(userId);
    if (!lobby || lobby.state !== "in_round" || !lobby.currentProblem) return;
    const p = lobby.players.get(userId);
    if (!p || p.submittedAt !== null) return;

    p.submittedAt = Date.now();
    p.answer = typeof answer === "string" ? answer.slice(0, 500) : "";
    const g = grade({
      answerType: lobby.currentProblem.answerType as "numeric" | "multiple_choice",
      submitted: p.answer,
      correctAnswer: lobby.currentProblem.correctAnswer,
      tolerance: lobby.currentProblem.tolerance ?? undefined,
      acceptableForms: lobby.currentProblem.acceptableForms ? safeJsonArray(lobby.currentProblem.acceptableForms) : undefined,
    });
    p.correct = g.correct;

    // Notify everyone in the lobby that this user has submitted (without
    // leaking correctness — that's revealed at round end).
    this.emitToLobby(lobby, "lobby:player_submitted", { userId: p.userId });

    // If everyone has submitted, end the round early.
    const allDone = Array.from(lobby.players.values()).every((q) => q.submittedAt !== null);
    if (allDone) {
      if (lobby.roundTimeoutHandle) clearTimeout(lobby.roundTimeoutHandle);
      this.endRound(lobby);
    }
  }

  handleDisconnect(userId: string): void {
    const lobby = this.lobbyForUser(userId);
    if (!lobby) return;
    const p = lobby.players.get(userId);
    if (!p) return;
    p.socketId = null;
    this.broadcastState(lobby);
    // We don't auto-leave on disconnect — players can reconnect within the
    // session. If they never come back, the lobby's idle cleanup will reap it.
  }

  handleReconnect(userId: string, socketId: string): void {
    const lobby = this.lobbyForUser(userId);
    if (!lobby) return;
    const p = lobby.players.get(userId);
    if (!p) return;
    p.socketId = socketId;
    this.io.sockets.sockets.get(socketId)?.join(`lobby:${lobby.code}`);
    // Re-send full state so the client rehydrates.
    this.io.sockets.sockets.get(socketId)?.emit("lobby:state", publicLobby(lobby));
    if (lobby.state === "in_round" && lobby.currentProblem && lobby.roundStartedAt) {
      this.io.sockets.sockets.get(socketId)?.emit("lobby:round_started", {
        round: lobby.round,
        rounds: lobby.settings.rounds,
        problem: this.publicProblem(lobby.currentProblem),
        roundStartedAt: lobby.roundStartedAt,
      });
    }
  }

  private async advanceRound(lobby: Lobby): Promise<void> {
    if (lobby.betweenTimeoutHandle) { clearTimeout(lobby.betweenTimeoutHandle); lobby.betweenTimeoutHandle = null; }
    lobby.round += 1;
    if (lobby.round > lobby.settings.rounds) {
      this.completeMatch(lobby);
      return;
    }
    // Reset per-round player state.
    for (const p of lobby.players.values()) {
      p.submittedAt = null;
      p.answer = null;
      p.correct = false;
    }
    const problem = await this.pickProblem(lobby);
    if (!problem) {
      this.emitToLobby(lobby, "lobby:error", { code: "no_problem", message: "Couldn't find a matching problem — try widening difficulty." });
      this.completeMatch(lobby);
      return;
    }
    lobby.currentProblem = problem;
    lobby.problemsServed.push(problem.id);
    lobby.state = "in_round";

    // Countdown then deliver.
    for (let s = COUNTDOWN_SECONDS; s >= 1; s--) {
      const secondsLeft = s;
      setTimeout(() => {
        if (lobby.state !== "in_round") return;
        this.emitToLobby(lobby, "lobby:countdown", { secondsLeft, round: lobby.round, rounds: lobby.settings.rounds });
      }, (COUNTDOWN_SECONDS - s) * 1000);
    }
    setTimeout(() => {
      if (lobby.state !== "in_round") return;
      lobby.roundStartedAt = Date.now();
      this.broadcastState(lobby);
      this.emitToLobby(lobby, "lobby:round_started", {
        round: lobby.round,
        rounds: lobby.settings.rounds,
        problem: this.publicProblem(problem),
        roundStartedAt: lobby.roundStartedAt,
      });
      lobby.roundTimeoutHandle = setTimeout(() => this.endRound(lobby), lobby.settings.timeLimitSec * 1000);
    }, COUNTDOWN_SECONDS * 1000);
  }

  private endRound(lobby: Lobby): void {
    if (lobby.state !== "in_round" || !lobby.currentProblem) return;
    lobby.state = "between_rounds";
    if (lobby.roundTimeoutHandle) { clearTimeout(lobby.roundTimeoutHandle); lobby.roundTimeoutHandle = null; }

    // Award points: rank correct submissions by submission time. Incorrect = 0.
    const correctOrdered = Array.from(lobby.players.values())
      .filter((p) => p.correct && p.submittedAt !== null)
      .sort((a, b) => (a.submittedAt as number) - (b.submittedAt as number));
    const placePoints = correctOrdered.map((p, i) => {
      const pts = POINTS_BY_PLACE[i] ?? 1;
      p.score += pts;
      return { userId: p.userId, points: pts, place: i + 1 };
    });

    // Per-round breakdown for the scoreboard view.
    const startedAt = lobby.roundStartedAt ?? Date.now();
    const playerBreakdown = Array.from(lobby.players.values()).map((p) => ({
      userId: p.userId,
      username: p.username,
      answer: p.answer,
      correct: p.correct,
      timeMs: p.submittedAt ? p.submittedAt - startedAt : null,
      pointsThisRound: placePoints.find((x) => x.userId === p.userId)?.points ?? 0,
      place: placePoints.find((x) => x.userId === p.userId)?.place ?? null,
      score: p.score,
    }));

    this.emitToLobby(lobby, "lobby:round_ended", {
      round: lobby.round,
      rounds: lobby.settings.rounds,
      correctAnswer: lobby.currentProblem.correctAnswer,
      solution: lobby.currentProblem.solution,
      players: playerBreakdown,
    });

    lobby.betweenTimeoutHandle = setTimeout(() => {
      void this.advanceRound(lobby);
    }, BETWEEN_ROUND_MS);
  }

  private completeMatch(lobby: Lobby): void {
    lobby.state = "complete";
    const final = Array.from(lobby.players.values())
      .map((p) => ({
        userId: p.userId,
        username: p.username,
        avatarColor: p.avatarColor,
        avatarInitials: p.avatarInitials,
        avatarImage: p.avatarImage,
        equippedTitle: p.equippedTitle,
        score: p.score,
      }))
      .sort((a, b) => b.score - a.score);
    this.emitToLobby(lobby, "lobby:complete", { final, rounds: lobby.settings.rounds });
    // Return to lobby waiting state after a brief delay so they can play again.
    setTimeout(() => {
      lobby.state = "waiting";
      lobby.round = 0;
      lobby.currentProblem = null;
      lobby.roundStartedAt = null;
      for (const p of lobby.players.values()) {
        p.score = 0;
        p.submittedAt = null;
        p.answer = null;
        p.correct = false;
      }
      this.broadcastState(lobby);
    }, 15_000);
  }

  private async pickProblem(lobby: Lobby): Promise<Problem | null> {
    // If host specified specific tiers/categories, sample from those directly
    // (the matchmaking-style ELO window from pickProblemForDuel isn't quite
    // right here — we want to honour the host's settings).
    const tiers = lobby.settings.tiers.length ? lobby.settings.tiers : null;
    const cats = lobby.settings.categories.length ? lobby.settings.categories : null;
    const candidates = await prisma.problem.findMany({
      where: {
        mode: "classic",
        id: lobby.problemsServed.length ? { notIn: lobby.problemsServed } : undefined,
        ...(tiers && { tier: { in: tiers } }),
        ...(cats && { category: { in: cats } }),
      },
      take: 100,
    });
    if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
    // Fallback: ignore exclusion list if we've exhausted the pool.
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

  private broadcastState(lobby: Lobby) {
    this.emitToLobby(lobby, "lobby:state", publicLobby(lobby));
  }

  private emitToLobby(lobby: Lobby, event: string, payload: unknown) {
    this.io.to(`lobby:${lobby.code}`).emit(event, payload);
  }

  private cleanupStaleLobbies() {
    const now = Date.now();
    for (const lobby of this.lobbies.values()) {
      if (now - lobby.lastActivity > LOBBY_TTL_MS) {
        if (lobby.roundTimeoutHandle) clearTimeout(lobby.roundTimeoutHandle);
        if (lobby.betweenTimeoutHandle) clearTimeout(lobby.betweenTimeoutHandle);
        for (const userId of lobby.players.keys()) this.userToLobby.delete(userId);
        this.lobbies.delete(lobby.code);
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
