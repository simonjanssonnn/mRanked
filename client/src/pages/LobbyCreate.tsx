import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSocket } from "../lib/socket";
import { PageHeader } from "../components/PageHeader";
import { CLASSIC_TIERS } from "../lib/ranks";

// Timer presets. Hours are gated behind a confirmation step in the UI because
// they only make sense for extremely involved problems (full Olympiad-style).
type TimeUnit = "sec" | "min" | "hr";
const UNIT_TO_SEC: Record<TimeUnit, number> = { sec: 1, min: 60, hr: 3600 };
const UNIT_BOUNDS: Record<TimeUnit, { min: number; max: number; step: number; default: number }> = {
  sec: { min: 15, max: 180, step: 5,  default: 45 },
  min: { min: 1,  max: 30,  step: 1,  default: 3  },
  hr:  { min: 1,  max: 2,   step: 1,  default: 1  },
};

// Categories the host can filter problems by. "nationella_3c" pulls only the
// Swedish gymnasium calculus problems; "word_problems" surfaces the longer
// applied prompts; the rest are the standard topic buckets.
const ALL_CATEGORIES = [
  "arithmetic", "algebra", "geometry", "trigonometry",
  "precalculus", "calculus", "number_theory", "combinatorics", "probability",
  "word_problems", "nationella_3c",
];

// Pretty labels for display — the underlying value sent to the server is the
// raw category key.
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
  nationella_3c: "Nationella Matte 3C",
};

export function LobbyCreate() {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState(5);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("sec");
  const [timeValue, setTimeValue] = useState<number>(UNIT_BOUNDS.sec.default);
  const [tiers, setTiers] = useState<string[]>(["Bronze", "Silver", "Gold"]);
  const [categories, setCategories] = useState<string[]>([]);

  const timeLimitSec = useMemo(() => timeValue * UNIT_TO_SEC[timeUnit], [timeValue, timeUnit]);
  const bounds = UNIT_BOUNDS[timeUnit];

  function changeUnit(next: TimeUnit) {
    setTimeUnit(next);
    setTimeValue(UNIT_BOUNDS[next].default);
  }

  function toggle(list: string[], setter: (v: string[]) => void, value: string) {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  function create() {
    getSocket().emit("lobby:create", {
      settings: { rounds, timeLimitSec, tiers, categories },
    });
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Create lobby" />
      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <div className="text-[10px] uppercase tracking-[0.3em] text-ink-500 mb-2">Custom lobby</div>
          <h1 className="text-3xl font-medium tracking-tight">Set the rules</h1>
          <p className="text-sm text-ink-700 mt-2">Up to 10 players, no ELO impact.</p>
        </div>

        {/* Rounds */}
        <section className="card p-5 mb-4">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-xs uppercase tracking-widest text-clay font-semibold">Rounds</div>
            <div className="text-2xl font-medium tabular-nums">{rounds}</div>
          </div>
          <input
            type="range" min={1} max={15} value={rounds}
            onChange={(e) => setRounds(parseInt(e.target.value, 10))}
            className="w-full accent-clay"
          />
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-ink-500 mt-1">
            <span>1</span><span>15</span>
          </div>
        </section>

        {/* Time per round */}
        <section className="card p-5 mb-4">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-xs uppercase tracking-widest text-clay font-semibold">Time per round</div>
            <div className="text-2xl font-medium tabular-nums">
              {timeValue}<span className="text-sm text-ink-600 ml-1">{timeUnit}</span>
            </div>
          </div>
          <input
            type="range" min={bounds.min} max={bounds.max} step={bounds.step} value={timeValue}
            onChange={(e) => setTimeValue(parseInt(e.target.value, 10))}
            className="w-full accent-clay"
          />
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-ink-500 mt-1">
            <span>{bounds.min}{timeUnit}</span><span>{bounds.max}{timeUnit}</span>
          </div>
          {/* Unit picker */}
          <div className="flex gap-1.5 mt-4 p-1 rounded-full bg-cream-100/40 border border-cream-200 w-fit">
            {(["sec", "min", "hr"] as TimeUnit[]).map((u) => (
              <button
                key={u}
                onClick={() => changeUnit(u)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  timeUnit === u ? "bg-clay text-cream-50" : "text-ink-700 hover:bg-cream-200/40"
                }`}
              >
                {u === "sec" ? "Seconds" : u === "min" ? "Minutes" : "Hours"}
              </button>
            ))}
          </div>
          {timeUnit === "hr" && (
            <div className="mt-3 px-3 py-2 rounded-lg border border-bad/40 bg-bad/10 text-xs text-bad">
              <span className="uppercase tracking-widest font-semibold">Extreme only</span>
              <span className="text-ink-700 ml-2">— recommended only for Olympiad-tier problems.</span>
            </div>
          )}
        </section>

        {/* Difficulty tiers */}
        <section className="card p-5 mb-4">
          <div className="text-xs uppercase tracking-widest text-clay font-semibold mb-1">Difficulty</div>
          <div className="text-xs text-ink-600 mb-3">Pick the tiers problems can come from.</div>
          <div className="flex flex-wrap gap-2">
            {CLASSIC_TIERS.map((t) => {
              const on = tiers.includes(t.name);
              return (
                <button
                  key={t.name}
                  onClick={() => toggle(tiers, setTiers, t.name)}
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

        {/* Categories */}
        <section className="card p-5 mb-6">
          <div className="text-xs uppercase tracking-widest text-clay font-semibold mb-1">Categories</div>
          <div className="text-xs text-ink-600 mb-3">Leave empty for any category. Pick "Nationella Matte 3C" for a Swedish gymnasium calculus set.</div>
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((c) => {
              const on = categories.includes(c);
              const isFeatured = c === "nationella_3c";
              return (
                <button
                  key={c}
                  onClick={() => toggle(categories, setCategories, c)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    on
                      ? "bg-clay text-cream-50 border-clay"
                      : isFeatured
                      ? "border-violet/40 text-violet hover:bg-violet/10"
                      : "border-cream-200 text-ink-700 hover:bg-cream-200/40"
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
          <button
            onClick={create}
            disabled={tiers.length === 0}
            className="btn-primary flex-1 py-3"
          >
            Create lobby
          </button>
        </div>
        {tiers.length === 0 && (
          <div className="text-xs text-bad mt-2 text-center">Pick at least one difficulty tier.</div>
        )}
      </main>
    </div>
  );
}
