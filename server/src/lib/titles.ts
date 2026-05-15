// Title catalog. Each title unlocks at a peak-ELO threshold so titles you've
// earned stay yours even if you dip back down. The client mirrors this list
// at client/src/lib/titles.ts — keep them in sync.

export type Title = {
  id: string;
  label: string;
  /** Minimum peak ELO required to unlock. */
  unlockAt: number;
  /** Display tier the title belongs to (controls visual flair on the client). */
  tier: "neutral" | "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master" | "grandmaster";
};

export const TITLES: Title[] = [
  { id: "",              label: "—",            unlockAt: 0,    tier: "neutral" },
  { id: "apprentice",    label: "Apprentice",   unlockAt: 800,  tier: "bronze" },
  { id: "adept",         label: "Adept",        unlockAt: 1100, tier: "silver" },
  { id: "scholar",       label: "Scholar",      unlockAt: 1400, tier: "gold" },
  { id: "sage",          label: "Sage",         unlockAt: 1700, tier: "platinum" },
  { id: "virtuoso",      label: "Virtuoso",     unlockAt: 2000, tier: "diamond" },
  { id: "archmage",      label: "Archmage",     unlockAt: 2300, tier: "master" },
  { id: "grandmaster",   label: "Grandmaster",  unlockAt: 2600, tier: "grandmaster" },
];

const BY_ID = new Map(TITLES.map((t) => [t.id, t]));

export function isTitleUnlocked(titleId: string, peakElo: number): boolean {
  if (!titleId) return true; // empty = no title equipped
  const t = BY_ID.get(titleId);
  if (!t) return false;
  return peakElo >= t.unlockAt;
}
