import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSocket } from "../lib/socket";
import { api } from "../lib/api";
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

// Topic categories — picked together with difficulty tiers as filters. These
// are the standard math buckets; multi-select is fine. "nationella_3c" lives
// in a separate "curated set" section below, NOT here, because it's a fixed
// problem set rather than a topic to mix and match.
const TOPIC_CATEGORIES = [
  "arithmetic", "algebra", "geometry", "trigonometry",
  "precalculus", "calculus", "number_theory", "combinatorics", "probability",
  "word_problems",
];

// Curated problem sets — exclusive (radio-button style). When one is picked
// it's the entire problem source: difficulty tier and topic filters are
// ignored because the set already curates them. Easy to extend with future
// sets (e.g. AMC, AIME, IMO).
const CURATED_SETS: Array<{ id: string; label: string; description: string }> = [
  {
    id: "nationella_3c",
    label: "Nationella Matte 3C",
    description: "Swedish gymnasium calculus — real questions from old NP exams.",
  },
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

const ALL_TIER_NAMES = CLASSIC_TIERS.map((t) => t.name);

export function LobbyCreate() {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState(5);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("sec");
  const [timeValue, setTimeValue] = useState<number>(UNIT_BOUNDS.sec.default);
  const [tiers, setTiers] = useState<string[]>(["Bronze", "Silver", "Gold"]);
  const [categories, setCategories] = useState<string[]>([]);
  // null = use the regular tier+topic filter. Otherwise: a curated set is
  // active and we ignore the other filters.
  const [curatedSet, setCuratedSet] = useState<string | null>(null);

  const usingCuratedSet = curatedSet !== null;
  const timeLimitSec = useMemo(() => timeValue * UNIT_TO_SEC[timeUnit], [timeValue, timeUnit]);
  const bounds = UNIT_BOUNDS[timeUnit];

  // Effective tiers/categories sent to the server: a curated set overrides
  // both — we send all tiers + the curated category so the server doesn't
  // accidentally narrow the pool further.
  const effectiveTiers = usingCuratedSet ? ALL_TIER_NAMES : tiers;
  const effectiveCategories = usingCuratedSet ? [curatedSet!] : categories;

  // Live problem-count preview. Whenever the effective filter changes we ask
  // the server how many problems match — saves the host from creating an
  // unstartable lobby.
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setCountLoading(true);
    api
      .problemCount(effectiveTiers, effectiveCategories)
      .then((r) => { if (!cancelled) setMatchCount(r.count); })
      .catch(() => { if (!cancelled) setMatchCount(null); })
      .finally(() => { if (!cancelled) setCountLoading(false); });
    return () => { cancelled = true; };
  }, [effectiveTiers, effectiveCategories]);

  function changeUnit(next: TimeUnit) {
    setTimeUnit(next);
    setTimeValue(UNIT_BOUNDS[next].default);
  }

  function toggleTier(value: string) {
    if (usingCuratedSet) return;
    setTiers((t) => (t.includes(value) ? t.filter((x) => x !== value) : [...t, value]));
  }
  function toggleCategory(value: string) {
    if (usingCuratedSet) return;
    setCategories((c) => (c.includes(value) ? c.filter((x) => x !== value) : [...c, value]));
  }
  function pickCuratedSet(id: string) {
    // Toggle off if already active, else switch to that set.
    setCuratedSet((cur) => (cur === id ? null : id));
  }

  function create() {
    getSocket().emit("lobby:create", {
      settings: { rounds, timeLimitSec, tiers: effectiveTiers, categories: effectiveCategories },
    });
  }

  const canCreate = matchCount !== 0 && (usingCuratedSet || tiers.length > 0);

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

        {/* Curated problem sets — exclusive, full-width tiles. */}
        <section className="card p-5 mb-4">
          <div className="text-xs uppercase tracking-widest text-clay font-semibold mb-1">Curated problem sets</div>
          <div className="text-xs text-ink-600 mb-3">
            Pick one to use a fixed set — difficulty &amp; topic filters are skipped when a curated set is active.
          </div>
          <div className="space-y-2">
            {CURATED_SETS.map((s) => {
              const on = curatedSet === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => pickCuratedSet(s.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${
                    on
                      ? "border-violet bg-violet/10"
                      : "border-cream-200 hover:border-violet/40 hover:bg-violet/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`font-semibold ${on ? "text-violet" : "text-ink-950"}`}>{s.label}</div>
                    <span className={`text-[10px] uppercase tracking-widest ${on ? "text-violet" : "text-ink-500"}`}>
                      {on ? "Selected" : "Tap to select"}
                    </span>
                  </div>
                  <div className="text-xs text-ink-600 mt-1">{s.description}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Difficulty + topics — disabled while a curated set is active. */}
        <div className={usingCuratedSet ? "opacity-40 pointer-events-none select-none" : ""}>
          <section className="card p-5 mb-4">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-xs uppercase tracking-widest text-clay font-semibold">Difficulty</div>
              {usingCuratedSet && (
                <span className="text-[10px] uppercase tracking-widest text-ink-500">Ignored (curated set active)</span>
              )}
            </div>
            <div className="text-xs text-ink-600 mb-3">Pick the tiers problems can come from.</div>
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

          <section className="card p-5 mb-6">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-xs uppercase tracking-widest text-clay font-semibold">Topics</div>
              {usingCuratedSet && (
                <span className="text-[10px] uppercase tracking-widest text-ink-500">Ignored (curated set active)</span>
              )}
            </div>
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
        </div>

        {/* Problem-count preview — host instantly sees if the filter is too narrow. */}
        <div className={`card-quiet p-3 mb-3 text-sm flex items-center justify-between ${
          matchCount === 0 ? "border-bad/40 bg-bad/10" : ""
        }`}>
          <div className="text-ink-700">
            {countLoading
              ? "Counting matching problems…"
              : matchCount === null
                ? "Couldn't reach the catalogue."
                : matchCount === 0
                  ? "No problems match this filter. Widen the tiers/topics or pick a curated set."
                  : `${matchCount} problem${matchCount === 1 ? "" : "s"} available${usingCuratedSet ? " in this set" : " with this filter"}.`}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => navigate("/modes")} className="btn-ghost flex-1 py-3">Cancel</button>
          <button onClick={create} disabled={!canCreate} className="btn-primary flex-1 py-3">
            Create lobby
          </button>
        </div>
        {!usingCuratedSet && tiers.length === 0 && (
          <div className="text-xs text-bad mt-2 text-center">Pick at least one difficulty tier or a curated set.</div>
        )}
      </main>
    </div>
  );
}
