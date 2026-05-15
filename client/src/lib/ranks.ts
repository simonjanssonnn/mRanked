// Mirror of server's ranks. Kept in sync manually for MVP.
export type Tier = { name: string; min: number; max: number };

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

export function tierForElo(elo: number): Tier {
  for (const t of CLASSIC_TIERS) {
    if (elo >= t.min && elo <= t.max) return t;
  }
  return CLASSIC_TIERS[0];
}

export const TIER_COLORS: Record<string, { ring: string; text: string; bg: string }> = {
  Initiate:    { ring: "ring-zinc-500/40",   text: "text-zinc-300",    bg: "bg-zinc-500/10" },
  Bronze:      { ring: "ring-amber-700/40",  text: "text-amber-400",   bg: "bg-amber-700/10" },
  Silver:      { ring: "ring-zinc-300/40",   text: "text-zinc-200",    bg: "bg-zinc-300/10" },
  Gold:        { ring: "ring-yellow-400/40", text: "text-yellow-300",  bg: "bg-yellow-400/10" },
  Platinum:    { ring: "ring-cyan-300/40",   text: "text-cyan-200",    bg: "bg-cyan-300/10" },
  Diamond:     { ring: "ring-sky-400/40",    text: "text-sky-300",     bg: "bg-sky-400/10" },
  Master:      { ring: "ring-fuchsia-400/40",text: "text-fuchsia-300", bg: "bg-fuchsia-400/10" },
  Grandmaster: { ring: "ring-rose-400/50",   text: "text-rose-300",    bg: "bg-rose-400/10" },
};
