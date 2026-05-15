import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";
import { COOKIE_NAME, verifyToken } from "../lib/auth.js";

const PLAYER_SELECT = {
  id: true,
  username: true,
  avatarColor: true,
  avatarInitials: true,
  avatarImage: true,
  equippedTitle: true,
  classicElo: true,
} as const;

export async function profileRoutes(app: FastifyInstance) {
  app.get("/me/history", async (req, reply) => {
    const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: "unauthenticated" });
    const payload = verifyToken(token);
    if (!payload) return reply.code(401).send({ error: "unauthenticated" });

    const matches = await prisma.match.findMany({
      where: {
        status: "completed",
        OR: [{ playerAId: payload.sub }, { playerBId: payload.sub }],
      },
      orderBy: { endedAt: "desc" },
      take: 25,
      include: {
        playerA: { select: PLAYER_SELECT },
        playerB: { select: PLAYER_SELECT },
      },
    });

    const problemIds = Array.from(new Set(matches.map((m) => m.problemId)));
    const problems = problemIds.length
      ? await prisma.problem.findMany({
          where: { id: { in: problemIds } },
          select: { id: true, prompt: true, correctAnswer: true, tier: true, category: true },
        })
      : [];
    const problemMap = new Map(problems.map((p) => [p.id, p]));

    const eloPoints = await prisma.eloHistory.findMany({
      where: { userId: payload.sub, mode: "classic" },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    return {
      matches: matches.map((m) => {
        const isA = m.playerAId === payload.sub;
        const me = isA ? m.playerA : m.playerB;
        const them = isA ? m.playerB : m.playerA;
        const p = problemMap.get(m.problemId) ?? null;
        return {
          id: m.id,
          mode: m.mode,
          endedAt: m.endedAt,
          problem: p && { prompt: p.prompt, correctAnswer: p.correctAnswer, tier: p.tier, category: p.category },
          you: {
            ...me,
            accuracy: isA ? m.aAccuracy : m.bAccuracy,
            timeMs: isA ? m.aTimeMs : m.bTimeMs,
            eloDelta: isA ? m.aEloDelta : m.bEloDelta,
            answer: isA ? m.aAnswer : m.bAnswer,
          },
          opponent: {
            ...them,
            accuracy: isA ? m.bAccuracy : m.aAccuracy,
            timeMs: isA ? m.bTimeMs : m.aTimeMs,
            answer: isA ? m.bAnswer : m.aAnswer,
          },
          result: m.winnerId === null ? "draw" : m.winnerId === payload.sub ? "win" : "loss",
        };
      }),
      eloHistory: eloPoints.map((e) => ({ at: e.createdAt, elo: e.eloAfter })),
    };
  });
}
