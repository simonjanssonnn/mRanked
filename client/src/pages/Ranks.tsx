import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../store/auth";
import { CLASSIC_TIERS, tierForElo } from "../lib/ranks";

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
  const navigate = useNavigate();
  if (!user) return null;
  const myTier = tierForElo(user.classicElo);

  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 flex items-center justify-between border-b border-cream-200">
        <button className="btn-subtle text-sm" onClick={() => navigate("/", { replace: true })}>← Home</button>
        <div className="font-serif text-xl">Ranks</div>
        <span className="w-12" />
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-2.5">
        <div className="text-center mb-6">
          <div className="text-xs uppercase tracking-widest text-ink-600">You are</div>
          <div className="font-serif text-5xl tabular-nums mt-1">{user.classicElo}</div>
          <div className="text-sm text-ink-700 mt-1">
            <span className="font-semibold">{myTier.name}</span>
            {myTier.max !== Infinity && <span className="text-ink-500"> · {Math.max(0, myTier.max - user.classicElo + 1)} to next tier</span>}
          </div>
        </div>

        {[...CLASSIC_TIERS].reverse().map((t) => {
          const isMine = t.name === myTier.name;
          const range = t.max === Infinity ? `${t.min}+` : `${t.min}–${t.max}`;
          const within = isMine && t.max !== Infinity
            ? Math.min(1, Math.max(0, (user.classicElo - t.min) / (t.max - t.min + 1)))
            : null;
          return (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              className={`card p-4 ${isMine ? "ring-2 ring-clay/30" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold">{t.name}</span>
                    {isMine && <span className="text-[10px] uppercase tracking-widest bg-clay/10 text-clay px-2 py-0.5 rounded-full">You</span>}
                  </div>
                  <div className="text-xs text-ink-600 mt-0.5 truncate">{DESCRIPTIONS[t.name]}</div>
                </div>
                <div className="font-mono tabular-nums text-sm text-ink-700">{range}</div>
              </div>
              {within !== null && (
                <div className="mt-3 h-1.5 rounded-full bg-cream-100 overflow-hidden">
                  <div className="h-full bg-clay" style={{ width: `${Math.round(within * 100)}%` }} />
                </div>
              )}
            </motion.div>
          );
        })}
      </main>
    </div>
  );
}
