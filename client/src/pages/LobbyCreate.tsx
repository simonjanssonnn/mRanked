import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSocket } from "../lib/socket";
import { PageHeader } from "../components/PageHeader";
import { CLASSIC_TIERS } from "../lib/ranks";

const ALL_CATEGORIES = [
  "arithmetic", "algebra", "geometry", "trigonometry",
  "precalculus", "calculus", "number_theory", "combinatorics", "probability",
];

export function LobbyCreate() {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState(5);
  const [timeLimitSec, setTimeLimitSec] = useState(45);
  const [tiers, setTiers] = useState<string[]>(["Bronze", "Silver", "Gold"]);
  const [categories, setCategories] = useState<string[]>([]);

  function toggle(list: string[], setter: (v: string[]) => void, value: string) {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  function create() {
    getSocket().emit("lobby:create", {
      settings: { rounds, timeLimitSec, tiers, categories },
    });
    // Server will emit "lobby:created" → App.tsx navigates to /lobby/:code.
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
            <div className="text-xs uppercase tracking-widest text-clay font-semibold">Seconds per round</div>
            <div className="text-2xl font-medium tabular-nums">{timeLimitSec}s</div>
          </div>
          <input
            type="range" min={15} max={180} step={5} value={timeLimitSec}
            onChange={(e) => setTimeLimitSec(parseInt(e.target.value, 10))}
            className="w-full accent-clay"
          />
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-ink-500 mt-1">
            <span>15s</span><span>180s</span>
          </div>
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
          <div className="text-xs text-ink-600 mb-3">Leave empty for any category.</div>
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((c) => {
              const on = categories.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggle(categories, setCategories, c)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    on ? "bg-clay text-cream-50 border-clay" : "border-cream-200 text-ink-700 hover:bg-cream-200/40"
                  }`}
                >
                  {c.replace(/_/g, " ")}
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
