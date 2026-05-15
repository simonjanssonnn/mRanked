import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { HistoryResponse } from "../lib/types";
import { useAuth } from "../store/auth";
import { Avatar } from "../components/Avatar";
import { CLASSIC_TIERS, TIER_COLORS, tierForElo } from "../lib/ranks";
import { MathBlock } from "../components/Math";

type Match = HistoryResponse["matches"][number];

export function Profile() {
  const user = useAuth((s) => s.user);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.history().then(setData).catch((e) => setErr(String(e)));
  }, []);

  // Draws are hidden from the profile: ties resolve by speed in the result
  // screen, and the legacy "draw" outcome would be visually noisy here.
  const visibleMatches = useMemo(
    () => (data?.matches ?? []).filter((m) => m.result !== "draw"),
    [data]
  );

  if (!user) return null;
  const tier = tierForElo(user.classicElo);
  const tierColors = TIER_COLORS[tier.name] ?? TIER_COLORS.Initiate;
  const nextTier = CLASSIC_TIERS[CLASSIC_TIERS.findIndex((t) => t.name === tier.name) + 1];
  const winRate = user.classicMatches > 0 ? Math.round((user.classicWins / user.classicMatches) * 100) : 0;

  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 flex items-center justify-between border-b border-cream-200">
        <button className="btn-subtle text-sm" onClick={() => navigate("/", { replace: true })}>← Home</button>
        <div className="font-serif text-xl">@{user.username}</div>
        <span className="w-12" />
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <section className="card-raised p-6 mb-6 flex items-center gap-5">
          <Avatar username={user.username} size="xl" self ring />
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-widest text-ink-600">Classic rating</div>
            <div className="font-serif text-5xl tabular-nums leading-tight">{user.classicElo}</div>
            <div className={`inline-flex items-center gap-2 mt-1 px-2.5 py-0.5 rounded-full ring-1 ${tierColors.ring} ${tierColors.bg}`}>
              <span className={`text-xs font-semibold ${tierColors.text}`}>{tier.name}</span>
              {nextTier && <span className="text-[10px] text-ink-600 tabular-nums">{tier.max - user.classicElo + 1} to {nextTier.name}</span>}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-4 gap-3 mb-8">
          <Stat label="Matches" value={user.classicMatches} />
          <Stat label="Wins" value={user.classicWins} valueClass="text-good" />
          <Stat label="Losses" value={user.classicLosses} valueClass="text-bad" />
          <Stat label="Win %" value={winRate} suffix="%" />
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-sm font-medium text-ink-700">Recent matches</div>
            <div className="text-[11px] text-ink-500 uppercase tracking-widest">Ties resolved by speed</div>
          </div>
          {err && <div className="text-bad text-sm">{err}</div>}
          {!data ? (
            <div className="text-ink-500 text-sm">Loading…</div>
          ) : visibleMatches.length === 0 ? (
            <div className="text-ink-500 text-sm">No matches yet. Play your first.</div>
          ) : (
            <div className="space-y-3">
              {visibleMatches.map((m) => (
                <MatchCard key={m.id} m={m} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MatchCard({ m }: { m: Match }) {
  const isWin = m.result === "win";
  const accent = isWin ? "border-good/40" : "border-bad/40";
  const dot = isWin ? "bg-good" : "bg-bad";

  // Speed comparison (only meaningful when both submitted).
  const both = m.you.timeMs != null && m.opponent.timeMs != null;
  const youFaster = both && (m.you.timeMs as number) < (m.opponent.timeMs as number);

  return (
    <div className={`card border ${accent} p-4`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
          <span className={`font-semibold ${isWin ? "text-good" : "text-bad"}`}>
            {isWin ? "Win" : "Loss"}
          </span>
          <span className="text-ink-600 text-sm truncate">vs @{m.opponent.username}</span>
          {m.problem && (
            <span className="hidden sm:inline chip-mute">
              {m.problem.tier} · {m.problem.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="tabular-nums text-ink-700">
            {m.you.timeMs == null ? "—" : `${(m.you.timeMs / 1000).toFixed(1)}s`}
          </span>
          <span className={`tabular-nums font-semibold ${m.you.eloDelta && m.you.eloDelta > 0 ? "text-good" : m.you.eloDelta && m.you.eloDelta < 0 ? "text-bad" : "text-ink-700"}`}>
            {m.you.eloDelta == null ? "—" : (m.you.eloDelta > 0 ? "+" : "") + m.you.eloDelta}
          </span>
        </div>
      </div>

      {/* Problem always visible — Brilliant-style "see the problem at a glance". */}
      {m.problem && (
        <>
          <div className="card-quiet p-3 mb-3">
            <div className="text-[10px] uppercase tracking-widest text-clay font-semibold mb-1.5">Problem</div>
            <MathBlock className="text-ink-900 leading-relaxed">{m.problem.prompt}</MathBlock>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <AnswerBox label="Your answer" value={m.you.answer} timeMs={m.you.timeMs} faster={youFaster && both} />
            <AnswerBox label={`@${m.opponent.username}`} value={m.opponent.answer} timeMs={m.opponent.timeMs} faster={!youFaster && both} />
          </div>
          <div className="mt-3 text-xs">
            <span className="text-[10px] uppercase tracking-widest text-ink-500 mr-2">Correct</span>
            <span className="text-ink-900"><MathBlock>{m.problem.correctAnswer}</MathBlock></span>
          </div>
        </>
      )}
    </div>
  );
}

function AnswerBox({ label, value, timeMs, faster }: {
  label: string; value: string | null; timeMs: number | null; faster: boolean;
}) {
  return (
    <div className={`card-quiet p-3 ${faster ? "ring-1 ring-clay/40" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-widest text-ink-500">{label}</div>
        {faster && <span className="chip-clay">Fastest</span>}
      </div>
      <div className="text-ink-900 break-all">{value ?? <em className="text-ink-500">no answer</em>}</div>
      <div className={`mt-1 tabular-nums ${faster ? "text-clay font-semibold" : "text-ink-600"}`}>
        {timeMs == null ? "—" : `${(timeMs / 1000).toFixed(2)}s`}
      </div>
    </div>
  );
}

function Stat({ label, value, valueClass, suffix }: { label: string; value: number; valueClass?: string; suffix?: string }) {
  return (
    <div className="card-quiet p-3 text-center">
      <div className={`text-2xl font-bold tabular-nums ${valueClass ?? "text-ink-950"}`}>
        {value}{suffix ?? ""}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-ink-600 mt-1">{label}</div>
    </div>
  );
}
