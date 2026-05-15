import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { HistoryResponse } from "../lib/types";
import { useAuth } from "../store/auth";
import { Avatar } from "../components/Avatar";
import { CLASSIC_TIERS, TIER_COLORS, tierForElo } from "../lib/ranks";
import { MathBlock } from "../components/Math";
import { TitleChip } from "../components/TitleChip";
import { PageHeader } from "../components/PageHeader";

type Match = HistoryResponse["matches"][number];

export function Profile() {
  const user = useAuth((s) => s.user);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    api.history().then(setData).catch((e) => setErr(String(e)));
  }, []);

  const matches = useMemo(() => data?.matches ?? [], [data]);
  const streak = useMemo(() => computeStreak(matches), [matches]);

  if (!user) return null;
  const tier = tierForElo(user.classicElo);
  const tierColors = TIER_COLORS[tier.name] ?? TIER_COLORS.Initiate;
  const nextTier = CLASSIC_TIERS[CLASSIC_TIERS.findIndex((t) => t.name === tier.name) + 1];
  const winRate = user.classicMatches > 0 ? Math.round((user.classicWins / user.classicMatches) * 100) : 0;

  return (
    <div className="min-h-screen">
      <PageHeader title="Profile" />

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Identity card */}
        <section className="card-raised p-6 mb-6">
          <div className="flex items-start gap-5 flex-wrap">
            <Avatar username={user.username} size="xl" self ring />
            <div className="flex-1 min-w-0">
              <div className="font-serif text-3xl text-ink-950 flex items-center gap-2 flex-wrap">
                @{user.username}
                <TitleChip titleId={user.equippedTitle} size="sm" />
              </div>
              <div className="text-xs text-ink-500 mt-1">
                Joined {new Date(user.createdAt).toLocaleDateString()}
              </div>
              <div className="mt-3 flex items-center gap-4 flex-wrap">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-ink-500">Rating</div>
                  <div className="font-serif text-4xl tabular-nums leading-none">{user.classicElo}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-ink-500">Peak</div>
                  <div className="font-serif text-3xl tabular-nums leading-none text-clay">{user.classicPeakElo}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-ink-500">Tier</div>
                  <div className={`inline-flex items-center gap-2 mt-0.5 px-2.5 py-0.5 rounded-full ring-1 ${tierColors.ring} ${tierColors.bg}`}>
                    <span className={`text-sm font-semibold ${tierColors.text}`}>{tier.name}</span>
                    {nextTier && tier.max !== Infinity && (
                      <span className="text-[10px] text-ink-600 tabular-nums">{tier.max - user.classicElo + 1} to next</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats grid */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <Stat label="Matches" value={user.classicMatches} />
          <Stat label="Wins" value={user.classicWins} valueClass="text-good" />
          <Stat label="Losses" value={user.classicLosses} valueClass="text-bad" />
          <Stat label="Win %" value={winRate} suffix="%" />
          <Stat
            label="Draws"
            value={user.classicDraws}
            valueClass="text-ink-700"
            sub="best-of-3 ties"
          />
          <Stat
            label="Current streak"
            value={Math.abs(streak)}
            valueClass={streak > 0 ? "text-good" : streak < 0 ? "text-bad" : "text-ink-700"}
            sub={streak > 0 ? "wins" : streak < 0 ? "losses" : "—"}
          />
          <Stat
            label="Rating Δ avg"
            value={avgDelta(matches)}
            valueClass={avgDelta(matches) > 0 ? "text-good" : avgDelta(matches) < 0 ? "text-bad" : "text-ink-700"}
            sub="last 25"
          />
          <Stat
            label="Avg solve"
            value={avgSolve(matches)}
            suffix="s"
            valueClass="text-ink-700"
          />
        </section>

        {/* History */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-sm font-medium text-ink-700">Recent matches</div>
            <div className="text-[11px] text-ink-500 uppercase tracking-widest">Tap to expand</div>
          </div>
          {err && <div className="text-bad text-sm">{err}</div>}
          {!data ? (
            <div className="text-ink-500 text-sm">Loading…</div>
          ) : matches.length === 0 ? (
            <div className="card p-6 text-center text-ink-500 text-sm">No matches yet. Play your first.</div>
          ) : (
            <div className="space-y-2.5">
              {matches.map((m) => (
                <MatchRow
                  key={m.id}
                  m={m}
                  expanded={expandedId === m.id}
                  onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MatchRow({ m, expanded, onToggle }: { m: Match; expanded: boolean; onToggle: () => void }) {
  const tone =
    m.result === "win" ? { border: "border-good/40", text: "text-good", chip: "chip-good", label: "Win" } :
    m.result === "loss" ? { border: "border-bad/40", text: "text-bad", chip: "chip-bad", label: "Loss" } :
    { border: "border-cream-200", text: "text-ink-700", chip: "chip-mute", label: "Draw" };

  const delta = m.you.eloDelta;
  const deltaClass = delta == null ? "text-ink-700" : delta > 0 ? "text-good" : delta < 0 ? "text-bad" : "text-ink-700";

  return (
    <div className={`card border ${tone.border} overflow-hidden`}>
      <button onClick={onToggle} className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-cream-100/30 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <span className={tone.chip}>{tone.label}</span>
          <span className="text-ink-600 text-sm truncate">vs <span className="text-ink-900 font-medium">@{m.opponent.username}</span></span>
          {m.problem && (
            <span className="hidden sm:inline chip-mute">{m.problem.tier} · {m.problem.category}</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="tabular-nums text-ink-700 hidden sm:inline">
            {m.you.timeMs == null ? "—" : `${(m.you.timeMs / 1000).toFixed(1)}s`}
          </span>
          <span className={`tabular-nums font-semibold ${deltaClass}`}>
            {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}
          </span>
          <svg className={`w-4 h-4 text-ink-500 transition-transform ${expanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </button>

      {expanded && m.problem && (
        <div className="px-4 pb-4 border-t border-cream-200">
          <div className="card-quiet p-3 mt-3">
            <div className="text-[10px] uppercase tracking-widest text-clay font-semibold mb-1.5">Problem</div>
            <MathBlock className="text-ink-900 leading-relaxed">{m.problem.prompt}</MathBlock>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs mt-3">
            <AnswerBox label="Your answer" value={m.you.answer} timeMs={m.you.timeMs} good={m.result === "win"} />
            <AnswerBox label={`@${m.opponent.username}`} value={m.opponent.answer} timeMs={m.opponent.timeMs} good={m.result === "loss"} />
          </div>
          <div className="mt-3 text-xs">
            <span className="text-[10px] uppercase tracking-widest text-ink-500 mr-2">Correct</span>
            <span className="text-ink-900"><MathBlock>{m.problem.correctAnswer}</MathBlock></span>
          </div>
        </div>
      )}
    </div>
  );
}

function AnswerBox({ label, value, timeMs, good }: {
  label: string; value: string | null; timeMs: number | null; good: boolean;
}) {
  return (
    <div className={`card-quiet p-3 ${good ? "ring-1 ring-good/40" : ""}`}>
      <div className="text-[10px] uppercase tracking-widest text-ink-500 mb-1">{label}</div>
      <div className="text-ink-900 break-all">{value ?? <em className="text-ink-500">no answer</em>}</div>
      <div className="mt-1 tabular-nums text-ink-600">
        {timeMs == null ? "—" : `${(timeMs / 1000).toFixed(2)}s`}
      </div>
    </div>
  );
}

function Stat({ label, value, valueClass, suffix, sub }: {
  label: string; value: number; valueClass?: string; suffix?: string; sub?: string;
}) {
  return (
    <div className="card-quiet p-4">
      <div className="text-[10px] uppercase tracking-widest text-ink-600">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${valueClass ?? "text-ink-950"}`}>
        {value}{suffix ?? ""}
      </div>
      {sub && <div className="text-[10px] text-ink-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function computeStreak(matches: Match[]): number {
  // Positive = win streak, negative = loss streak. Draws and missing results break the streak.
  if (!matches.length) return 0;
  let dir: "win" | "loss" | null = null;
  let count = 0;
  for (const m of matches) {
    if (m.result === "win") {
      if (dir === "loss") break;
      dir = "win";
      count++;
    } else if (m.result === "loss") {
      if (dir === "win") break;
      dir = "loss";
      count++;
    } else {
      break;
    }
  }
  return dir === "loss" ? -count : count;
}

function avgDelta(matches: Match[]): number {
  const deltas = matches.map((m) => m.you.eloDelta).filter((d): d is number => d != null);
  if (!deltas.length) return 0;
  return Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
}

function avgSolve(matches: Match[]): number {
  const times = matches.map((m) => m.you.timeMs).filter((t): t is number => t != null);
  if (!times.length) return 0;
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length / 1000);
}
