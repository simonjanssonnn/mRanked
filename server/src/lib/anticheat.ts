// Layer-1 anti-cheat: per-tier minimum solve times.
//
// The premise: a human cannot read a problem prompt and submit a correct
// answer in under ~200 ms (just reaction + click), and harder problems
// genuinely take longer. Anything below the tier's floor is either:
//   - a bot scraping the DOM and answering via an API, or
//   - the player accidentally double-tapping (rare and they'd be wrong anyway).
//
// On detection we mark the submission as incorrect (so the cheater can't win
// the round on raw speed) and bump the user's suspicionScore. Score is purely
// for analytics + future shadow-ranking; the cheater never sees it.

import { prisma } from "./db.js";

// Floors are deliberately lenient at the low tier (200ms for Initiate) so a
// fast typer or lucky multiple-choice click isn't punished. Anything below
// these is essentially impossible without automation.
const MIN_SOLVE_MS: Record<string, number> = {
  Initiate: 200,
  Bronze: 350,
  Silver: 500,
  Gold: 800,
  Platinum: 1200,
  Diamond: 1800,
  Master: 2500,
  Grandmaster: 3200,
};

const DEFAULT_FLOOR_MS = 200;
const SUSPICION_BUMP = 25;

export function minSolveMs(tier: string): number {
  return MIN_SOLVE_MS[tier] ?? DEFAULT_FLOOR_MS;
}

export function isImpossiblyFast(tier: string, timeMs: number): boolean {
  return Number.isFinite(timeMs) && timeMs < minSolveMs(tier);
}

export async function flagSuspiciousSubmission(args: {
  userId: string;
  tier: string;
  timeMs: number;
  reason: string;
}): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: args.userId },
      data: { suspicionScore: { increment: SUSPICION_BUMP } },
    });
    console.warn(
      `[anticheat] flagged user=${args.userId} tier=${args.tier} ` +
        `timeMs=${args.timeMs.toFixed(0)} reason=${args.reason} (+${SUSPICION_BUMP})`,
    );
  } catch (err) {
    // Anti-cheat must never break the duel resolution path. If the update
    // fails (race, transient DB error) we just log and continue.
    console.warn(`[anticheat] failed to flag user=${args.userId}:`, err);
  }
}
