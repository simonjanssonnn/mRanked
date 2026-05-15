// Mirror of server/src/lib/titles.ts — keep in sync.

export type TitleTier =
  | "neutral" | "bronze" | "silver" | "gold"
  | "platinum" | "diamond" | "master" | "grandmaster";

export type Title = {
  id: string;
  label: string;
  unlockAt: number;
  tier: TitleTier;
};

export const TITLES: Title[] = [
  { id: "",            label: "—",            unlockAt: 0,    tier: "neutral" },
  { id: "apprentice",  label: "Apprentice",   unlockAt: 800,  tier: "bronze" },
  { id: "adept",       label: "Adept",        unlockAt: 1100, tier: "silver" },
  { id: "scholar",     label: "Scholar",      unlockAt: 1400, tier: "gold" },
  { id: "sage",        label: "Sage",         unlockAt: 1700, tier: "platinum" },
  { id: "virtuoso",    label: "Virtuoso",     unlockAt: 2000, tier: "diamond" },
  { id: "archmage",    label: "Archmage",     unlockAt: 2300, tier: "master" },
  { id: "grandmaster", label: "Grandmaster",  unlockAt: 2600, tier: "grandmaster" },
];

const BY_ID = new Map(TITLES.map((t) => [t.id, t]));

export function getTitle(id: string): Title | null {
  return BY_ID.get(id) ?? null;
}

export function isTitleUnlocked(titleId: string, peakElo: number): boolean {
  if (!titleId) return true;
  const t = BY_ID.get(titleId);
  if (!t) return false;
  return peakElo >= t.unlockAt;
}

/**
 * Tailwind class bundles per tier. Coolness scales with tier:
 *  - low tiers: flat colored chip
 *  - mid tiers: subtle ring + glow
 *  - high tiers: gradient text, animated shimmer, colored aura
 *  - grandmaster: animated red glow that pulses
 */
export const TITLE_STYLES: Record<TitleTier, {
  /** Chip wrapper classes */
  chip: string;
  /** Inner label classes (text color, shimmer etc.) */
  label: string;
  /** Optional dot / icon to render before the label */
  icon?: string;
}> = {
  neutral: {
    chip: "bg-cream-200/40 border border-cream-300/40",
    label: "text-ink-600",
  },
  bronze: {
    chip: "bg-amber-700/15 border border-amber-700/30",
    label: "text-amber-300",
    icon: "•",
  },
  silver: {
    chip: "bg-zinc-300/10 border border-zinc-300/30",
    label: "text-zinc-200",
    icon: "•",
  },
  gold: {
    chip: "bg-yellow-400/10 border border-yellow-400/40 shadow-[0_0_12px_-4px_rgba(250,204,21,0.5)]",
    label: "text-yellow-300",
    icon: "✦",
  },
  platinum: {
    chip: "bg-cyan-300/10 border border-cyan-300/40 shadow-[0_0_14px_-4px_rgba(103,232,249,0.55)]",
    label: "text-cyan-200",
    icon: "✦",
  },
  diamond: {
    chip: "bg-sky-400/10 border border-sky-400/50 shadow-[0_0_18px_-3px_rgba(56,189,248,0.65)]",
    label: "text-sky-200 font-semibold",
    icon: "◆",
  },
  master: {
    chip: "bg-fuchsia-500/10 border border-fuchsia-400/60 shadow-[0_0_22px_-2px_rgba(217,70,239,0.7)]",
    label: "text-fuchsia-200 font-semibold",
    icon: "✪",
  },
  grandmaster: {
    // Animated red glow + shimmer. Defined in index.css.
    chip: "title-grandmaster",
    label: "title-grandmaster-label",
    icon: "♛",
  },
};
