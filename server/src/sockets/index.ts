import type { Server, Socket } from "socket.io";
import { prisma } from "../lib/db.js";
import { COOKIE_NAME, verifyToken } from "../lib/auth.js";
import { Matchmaker, type QueueEntry } from "./matchmaker.js";
import { DuelManager } from "./duel.js";
import { tierForElo } from "../lib/ranks.js";

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === name) return decodeURIComponent(v);
  }
  return null;
}

export function registerSocketGateway(io: Server) {
  const duelManager = new DuelManager(io);
  const matchmaker = new Matchmaker(async (a, b) => {
    const [userA, userB] = await Promise.all([
      prisma.user.findUnique({ where: { id: a.userId } }),
      prisma.user.findUnique({ where: { id: b.userId } }),
    ]);
    if (!userA || !userB) return;
    await duelManager.startDuel({
      mode: a.mode,
      a: {
        userId: userA.id,
        username: userA.username,
        socketId: a.socketId,
        elo: userA.classicElo,
        matches: userA.classicMatches,
        avatarColor: userA.avatarColor,
        avatarInitials: userA.avatarInitials,
        avatarImage: userA.avatarImage,
        equippedTitle: userA.equippedTitle,
      },
      b: {
        userId: userB.id,
        username: userB.username,
        socketId: b.socketId,
        elo: userB.classicElo,
        matches: userB.classicMatches,
        avatarColor: userB.avatarColor,
        avatarInitials: userB.avatarInitials,
        avatarImage: userB.avatarImage,
        equippedTitle: userB.equippedTitle,
      },
    });
  });
  matchmaker.start();

  setInterval(() => {
    for (const [, socket] of io.sockets.sockets) {
      const userId = (socket.data as { userId?: string }).userId;
      if (!userId) continue;
      if (matchmaker.has(userId)) {
        const range = matchmaker.rangeFor(userId) ?? 0;
        socket.emit("queue:waiting", { searchRange: range });
      }
    }
  }, 1000);

  io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie;
    const token = parseCookie(cookieHeader, COOKIE_NAME);
    if (!token) return next(new Error("unauthenticated"));
    const payload = verifyToken(token);
    if (!payload) return next(new Error("unauthenticated"));
    (socket.data as { userId?: string; username?: string }).userId = payload.sub;
    (socket.data as { userId?: string; username?: string }).username = payload.username;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket.data as { userId?: string }).userId!;
    const username = (socket.data as { username?: string }).username!;

    duelManager.handleReconnect(userId, socket.id);

    socket.on("queue:join", async (payload: { mode?: string }) => {
      const mode = payload?.mode ?? "classic";
      if (mode !== "classic") {
        socket.emit("error", { code: "unsupported_mode", message: "Only classic mode in MVP." });
        return;
      }
      if (duelManager.matchIdForUser(userId)) {
        socket.emit("error", { code: "in_match", message: "Already in a match." });
        return;
      }
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return;
      const entry: QueueEntry = {
        userId,
        username,
        socketId: socket.id,
        elo: user.classicElo,
        mode,
        joinedAt: Date.now(),
      };
      matchmaker.join(entry);
      socket.emit("queue:waiting", { searchRange: 50 });
    });

    socket.on("queue:leave", () => {
      matchmaker.leave(userId);
      socket.emit("queue:left", {});
    });

    socket.on("match:answer", (payload: { matchId: string; answer: string }) => {
      if (!payload?.matchId || typeof payload.answer !== "string") return;
      duelManager.handleAnswer(userId, payload);
    });

    // Player intentionally bailed (back button / "Leave" button / tab close
    // detected via `beforeunload`). Settle the match right away instead of
    // hanging on a grace timer.
    socket.on("match:forfeit", () => {
      duelManager.handleForfeit(userId);
    });

    socket.on("disconnect", () => {
      matchmaker.leave(userId);
      duelManager.handleDisconnect(userId);
    });
  });

  void tierForElo;
}
