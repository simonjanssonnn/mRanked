import { motion } from "framer-motion";
import { useAuth } from "../store/auth";
import { CLASSIC_TIERS, TIER_COLORS, tierForElo } from "../lib/ranks";
import { PageHeader } from "../components/PageHeader";

const DESCRIPTIONS: Record<string, string> = {
  Initiate:    "Arithmetic, fractions, percentages, single-step word problems",
  Bronze:      "Pre-algebra, linear equations, basic geometry, ratios",
  Silver:      "Algebra I, systems of equations, coordinate geometry",
  Gold:        "Algebra II, quadratics, geometry proofs, intro trigonometry",
  Platinum:    "Precalculus, functions, sequences & series, logarithms",
  Diamond:     "Single-variable calculus, advanced algebra, intro number theory",
  Master:      "Competition math (AMC/AIME), combinatorics, deeper number theory",
  Grandmaster: "Olympiad-level (IMO/Putnam-style) multi-step problems",
};

export function Ranks() {
  const user = useAuth((s) => s.user);
  if (!user) return null;
  const myTier = tierForElo(user.classicElo);
  const myIndex = CLASSIC_TIERS.findIndex((t) => t.name === myTier.name);

  return (
    <div className="min-h-screen">
      <PageHeader title="Ranks" />

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* You-are-here banner */}
        <section className="card-raised p-6 mb-8">
          <div className="flex items-center justify-between gap-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-ink-500">You are</div>
              <div className="font-serif text-5xl tabular-nums leading-tight">{user.classicElo}</div>
              <div className="mt-1 inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full ring-1 ring-clay/40 bg-clay/10">
                <span className="text-sm font-semibold text-clay">{myTier.name}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-ink-500">Peak</div>
              <div className="font-serif text-2xl tabular-nums">{user.classicPeakElo}</div>
              {myTier.max !== Infinity && (
                <div className="text-xs text-ink-600 mt-1 tabular-nums">
                  {Math.max(0, myTier.max - user.classicElo + 1)} to next
                </div>
              )}
            </div>
          </div>
          {/* Ladder progress through ALL tiers */}
          <div className="mt-5">
            <div className="relative h-2 rounded-full bg-cream-200 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-clay via-violet to-rose-400"
                style={{
                  width: `${Math.min(100, ((myIndex + (myTier.max === Infinity ? 1 : (user.classicElo - myTier.min) / (myTier.max - myTier.min + 1))) / CLASSIC_TIERS.length) * 100)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[9px] uppercase tracking-widest text-ink-500 mt-1.5">
              {CLASSIC_TIERS.map((t) => (
                <span key={t.name} className={t.name === myTier.name ? "text-clay font-semibold" : ""}>
                  {t.name.slice(0, 3)}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Tier cards */}
        <div className="space-y-3">
          {[...CLASSIC_TIERS].reverse().map((t) => {
            const isMine = t.name === myTier.name;
            const range = t.max === Infinity ? `${t.min}+` : `${t.min}–${t.max}`;
            const within = isMine && t.max !== Infinity
              ? Math.min(1, Math.max(0, (user.classicElo - t.min) / (t.max - t.min + 1)))
              : null;
            const tc = TIER_COLORS[t.name] ?? TIER_COLORS.Initiate;
            return (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                className={`card p-5 ${isMine ? "ring-2 ring-clay/40 shadow-glow" : ""}`}
              >
                <div className="flex items-center gap-4">
                  <TierMedal name={t.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-lg font-semibold ${tc.text}`}>{t.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest tabular-nums ${tc.bg} ${tc.text}`}>
                        {range}
                      </span>
                      {isMine && <span className="chip-clay">You</span>}
                    </div>
                    <div className="text-xs text-ink-600 mt-1">{DESCRIPTIONS[t.name]}</div>
                  </div>
                </div>
                {within !== null && (
                  <div className="mt-4">
                    <div className="h-1.5 rounded-full bg-cream-100 overflow-hidden">
                      <div className="h-full bg-clay" style={{ width: `${Math.round(within * 100)}%` }} />
                    </div>
                    <div className="text-[10px] tabular-nums text-ink-500 mt-1">
                      {Math.round(within * 100)}% through {t.name}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

// Tiny tier medal — a coloured ring with the tier initial.
function TierMedal({ name }: { name: string }) {
  const tc = TIER_COLORS[name] ?? TIER_COLORS.Initiate;
  return (
    <div className={`w-12 h-12 rounded-2xl ring-2 ${tc.ring} ${tc.bg} flex items-center justify-center shrink-0`}>
      <span className={`font-serif text-xl font-bold ${tc.text}`}>{name[0]}</span>
    </div>
  );
}
