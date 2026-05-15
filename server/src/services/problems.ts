import { prisma } from "../lib/db.js";

// Pick a problem whose difficultyElo is closest to the duel's target ELO.
// MVP: simple windowed lookup with a fallback. Avoid recently-served-to-this-player later.
export async function pickProblemForDuel(opts: {
  mode: string;
  targetElo: number;
  excludeIds?: string[];
}) {
  const { mode, targetElo, excludeIds = [] } = opts;

  // Try progressively wider windows.
  for (const window of [150, 300, 600, 1200, 5000]) {
    const candidates = await prisma.problem.findMany({
      where: {
        mode,
        id: excludeIds.length ? { notIn: excludeIds } : undefined,
        difficultyElo: { gte: targetElo - window, lte: targetElo + window },
      },
      take: 50,
    });
    if (candidates.length) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
  }
  // Absolute fallback: any problem in the mode
  const any = await prisma.problem.findFirst({ where: { mode } });
  return any;
}
