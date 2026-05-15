// Rank tier mapping per §4 of the spec.
// One source of truth, used both server- and (mirrored on) client-side.

export type Tier = {
  name: string;
  min: number;
  max: number; // inclusive upper bound; Infinity for top tier
};

export const CLASSIC_TIERS: Tier[] = [
  { name: "Initiate",    min: 0,    max: 799 },
  { name: "Bronze",      min: 800,  max: 1099 },
  { name: "Silver",      min: 1100, max: 1399 },
  { name: "Gold",        min: 1400, max: 1699 },
  { name: "Platinum",    min: 1700, max: 1999 },
  { name: "Diamond",     min: 2000, max: 2299 },
  { name: "Master",      min: 2300, max: 2599 },
  { name: "Grandmaster", min: 2600, max: Infinity },
];

export function tierForElo(elo: number, tiers: Tier[] = CLASSIC_TIERS): Tier {
  for (const t of tiers) {
    if (elo >= t.min && elo <= t.max) return t;
  }
  // Fallback (shouldn't happen with ELO_FLOOR=0)
  return tiers[0];
}

export function rankChange(oldElo: number, newElo: number, tiers: Tier[] = CLASSIC_TIERS) {
  const oldTier = tierForElo(oldElo, tiers);
  const newTier = tierForElo(newElo, tiers);
  if (oldTier.name === newTier.name) return { changed: false as const, oldTier, newTier };
  const direction = newElo > oldElo ? "promotion" : "demotion";
  return { changed: true as const, oldTier, newTier, direction };
}
