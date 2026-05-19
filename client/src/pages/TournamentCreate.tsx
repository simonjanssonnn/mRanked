import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSocket } from "../lib/socket";
import { PageHeader } from "../components/PageHeader";
import { CLASSIC_TIERS } from "../lib/ranks";

const TOPIC_CATEGORIES = [
  "arithmetic", "algebra", "geometry", "trigonometry",
  "precalculus", "calculus", "number_theory", "combinatorics", "probability",
  "word_problems",
];

const CATEGORY_LABELS: Record<string, string> = {
  arithmetic: "arithmetic",
  algebra: "algebra",
  geometry: "geometry",
  trigonometry: "trigonometry",
  precalculus: "precalculus",
  calculus: "calculus",
  number_theory: "number theory",
  combinatorics: "combinatorics",
  probability: "probability",
  word_problems: "word problems",
};

const BRACKET_SIZES = [4, 8, 16] as const;
const BEST_OF = [1, 3, 5] as const;
type BracketSize = typeof BRACKET_SIZES[number];
type BestOf = typeof BEST_OF[number];

export function TournamentCreate() {
  const navigate = useNavigate();
  const [bracketSize, setBracketSize] = useState<BracketSize>(4);
  const [bestOf, setBestOf] = useState<BestOf>(3);
  const [timeLimitSec, setTimeLimitSec] = useState(45);
  const [tiers, setTiers] = useState<string[]>(["Bronze", "Silver", "Gold"]);
  const [categories, setCategories] = useState<string[]>([]);

  function toggleTier(name: string) {
    setTiers((t) => (t.includes(name) ? t.filter((x) => x !== name) : [...t, name]));
  }
  function toggleCategory(c: string) {
    setCategories((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  }

  function create() {
    getSocket().emit("tournament:create", {
      settings: { bracketSize, bestOf, timeLimitSec, tiers, categories },
    });
  }

  const canCreate = tiers.length > 0;

  return (
    <div className="min-h-screen">
      <PageHeader title="Create tournament" />
      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <div className="text-[10px] uppercase tracking-[0.3em] text-ink-500 mb-2">Custom · single-elimination</div>
          <h1 className="text-3xl font-medium tracking-tight">Set the bracket</h1>
          <p className="text-sm text-ink-700 mt-2">Winners advance; one player remains. No ELO impact.</p>
        </div>

        {/* Bracket size */}
        <section className="card p-5 mb-4">
          <div className="text-xs uppercase tracking-widest text-clay font-semibold mb-3">Bracket size</div>
          <div className="flex gap-2">
            {BRACKET_SIZES.map((n) => (
              <button
                key={n}
                onClick={() => setBracketSize(n)}
                className={`flex-1 py-3 rounded-xl border font-medium transition-colors ${
                  bracketSize === n
                    ? "bg-clay text-cream-50 border-clay"
                    : "border-cream-200 text-ink-700 hover:bg-cream-200/40"
                }`}
              >
                {n} players
              </button>
            ))}
          </div>
          <div className="text-[11px] text-ink-500 mt-2">
            Empty slots become byes — the bracket runs even if fewer players join.
          </div>
        </section>

        {/* Best of */}
        <section className="card p-5 mb-4">
          <div className="text-xs uppercase tracking-widest text-clay font-semibold mb-3">Best of</div>
          <div className="flex gap-2">
            {BEST_OF.map((n) => (
              <button
                key={n}
                onClick={() => setBestOf(n)}
                className={`flex-1 py-3 rounded-xl border font-medium transition-colors ${
                  bestOf === n
                    ? "bg-clay text-cream-50 border-clay"
                    : "border-cream-200 text-ink-700 hover:bg-cream-200/40"
                }`}
              >
                Bo{n}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-ink-500 mt-2">
            First to {Math.ceil(bestOf / 2)} game{Math.ceil(bestOf / 2) > 1 ? "s" : ""} wins the match.
          </div>
        </section>

        {/* Time per game */}
        <section className="card p-5 mb-4">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-xs uppercase tracking-widest text-clay font-semibold">Time per game</div>
            <div className="text-2xl font-medium tabular-nums">
              {timeLimitSec}<span className="text-sm text-ink-600 ml-1">sec</span>
            </div>
          </div>
          <input
            type="range" min={15} max={300} step={5} value={timeLimitSec}
            onChange={(e) => setTimeLimitSec(parseInt(e.target.value, 10))}
            className="w-full accent-clay"
          />
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-ink-500 mt-1">
            <span>15s</span><span>5min</span>
          </div>
        </section>

        {/* Difficulty */}
        <section className="card p-5 mb-4">
          <div className="text-xs uppercase tracking-widest text-clay font-semibold mb-1">Difficulty</div>
          <div className="text-xs text-ink-600 mb-3">Pick tiers problems can come from.</div>
          <div className="flex flex-wrap gap-2">
            {CLASSIC_TIERS.map((t) => {
              const on = tiers.includes(t.name);
              return (
                <button
                  key={t.name}
                  onClick={() => toggleTier(t.name)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    on ? "bg-clay text-cream-50 border-clay" : "border-cream-200 text-ink-700 hover:bg-cream-200/40"
                  }`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* Topics */}
        <section className="card p-5 mb-6">
          <div className="text-xs uppercase tracking-widest text-clay font-semibold mb-1">Topics</div>
          <div className="text-xs text-ink-600 mb-3">Leave empty for any topic.</div>
          <div className="flex flex-wrap gap-2">
            {TOPIC_CATEGORIES.map((c) => {
              const on = categories.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleCategory(c)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    on ? "bg-clay text-cream-50 border-clay" : "border-cream-200 text-ink-700 hover:bg-cream-200/40"
                  }`}
                >
                  {CATEGORY_LABELS[c] ?? c.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex gap-3">
          <button onClick={() => navigate("/modes")} className="btn-ghost flex-1 py-3">Cancel</button>
          <button onClick={create} disabled={!canCreate} className="btn-primary flex-1 py-3">
            Create bracket
          </button>
        </div>
        {tiers.length === 0 && (
          <div className="text-xs text-bad mt-2 text-center">Pick at least one difficulty tier.</div>
        )}
      </main>
    </div>
  );
}
