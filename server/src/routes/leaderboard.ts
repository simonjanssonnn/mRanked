import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get("/leaderboard", async () => {
    const top = await prisma.user.findMany({
      orderBy: { classicElo: "desc" },
      take: 100,
      select: {
        id: true,
        username: true,
        classicElo: true,
        classicPeakElo: true,
        classicMatches: true,
        classicWins: true,
        classicLosses: true,
        avatarColor: true,
        avatarInitials: true,
        avatarImage: true,
        equippedTitle: true,
      },
    });
    return { entries: top };
  });
}
