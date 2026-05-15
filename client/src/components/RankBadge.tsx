import { tierForElo, TIER_COLORS } from "../lib/ranks";

export function RankBadge({ elo, size = "md" }: { elo: number; size?: "sm" | "md" | "lg" }) {
  const tier = tierForElo(elo);
  const colors = TIER_COLORS[tier.name] ?? TIER_COLORS.Initiate;
  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full ring-1 ${colors.ring} ${colors.bg} ${colors.text} ${sizes[size]} font-semibold`}>
      <span className="opacity-90">{tier.name}</span>
      <span className="opacity-60 font-mono">{elo}</span>
    </span>
  );
}
