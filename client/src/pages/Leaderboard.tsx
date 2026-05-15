import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { Avatar } from "../components/Avatar";
import { TIER_COLORS, tierForElo } from "../lib/ranks";
import { PageHeader } from "../components/PageHeader";

type Entry = {
  id: string;
  username: string;
  classicElo: number;
  classicMatches: number;
  classicWins: number;
  classicLosses: number;
  equippedTitle?: string;
};

export function Leaderboard() {
  const me = useAuth((s) => s.user);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.leaderboard().then((d) => setEntries(d.entries)).catch((e) => setErr(String(e)));
  }, []);

  const podium = useMemo(() => (entries ?? []).slice(0, 3), [entries]);
  const rest = useMemo(() => (entries ?? []).slice(3), [entries]);
  const myRank = useMemo(() => (entries && me ? entries.findIndex((e) => e.id === me.id) : -1), [entries, me]);

  return (
    <div className="min-h-screen">
      <PageHeader title="Leaderboard" />

      <main className="max-w-3xl mx-auto px-6 py-8">
        {err && <div className="text-bad text-sm mb-4">{err}</div>}

        {!entries ? (
          <div className="text-ink-500 text-sm text-center py-12">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-ink-500 text-sm text-center py-12">No players yet. Be the first.</div>
        ) : (
          <>
            {/* Podium */}
            {podium.length > 0 && (
              <section className="mb-8">
                <div className="text-[10px] uppercase tracking-[0.3em] text-ink-500 mb-3 text-center">Top of the ladder</div>
                <div className="grid grid-cols-3 gap-3 items-end">
                  <PodiumCard entry={podium[1]} place={2} height="md" isMe={me?.id === podium[1]?.id} />
                  <PodiumCard entry={podium[0]} place={1} height="lg" isMe={me?.id === podium[0]?.id} />
                  <PodiumCard entry={podium[2]} place={3} height="sm" isMe={me?.id === podium[2]?.id} />
                </div>
              </section>
            )}

            {/* My position callout (only if I'm beyond the podium) */}
            {me && myRank >= 3 && entries[myRank] && (
              <div className="card-quiet p-3 mb-4 flex items-center gap-3">
                <div className="w-10 text-center font-bold tabular-nums text-ink-700">#{myRank + 1}</div>
                <Avatar username={entries[myRank].username} size="md" self ring />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">@{entries[myRank].username}</div>
                  <div className="text-[10px] uppercase tracking-widest text-clay">Your position</div>
                </div>
                <div className="text-2xl font-bold tabular-nums text-clay">{entries[myRank].classicElo}</div>
              </div>
            )}

            {/* Rest */}
            <div className="card overflow-hidden divide-y divide-cream-200">
              {rest.map((e, i) => {
                const place = i + 4;
                const isMe = me?.id === e.id;
                const t = tierForElo(e.classicElo);
                const tc = TIER_COLORS[t.name] ?? TIER_COLORS.Initiate;
                return (
                  <div
                    key={e.id}
                    className={`px-4 py-3 flex items-center gap-4 transition-colors ${isMe ? "bg-clay/5 ring-1 ring-clay/30" : "hover:bg-cream-100/30"}`}
                  >
                    <div className="w-10 text-right tabular-nums text-sm text-ink-600 font-semibold">
                      #{place}
                    </div>
                    <Avatar username={e.username} size="md" self={isMe} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        @{e.username}
                        {isMe && <span className="chip-clay">You</span>}
                      </div>
                      <div className="text-xs text-ink-600 flex items-center gap-2 mt-0.5">
                        <span className={`px-1.5 py-0.5 rounded-full ${tc.bg} ${tc.text}`}>{t.name}</span>
                        <span className="text-ink-500 tabular-nums">{e.classicMatches} matches</span>
                        <span className="text-ink-500">·</span>
                        <span className="tabular-nums text-good">{e.classicWins}W</span>
                        <span className="tabular-nums text-bad">{e.classicLosses}L</span>
                      </div>
                    </div>
                    <div className="text-2xl font-bold tabular-nums text-ink-900">{e.classicElo}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function PodiumCard({ entry, place, height, isMe }: {
  entry: Entry | undefined;
  place: number;
  height: "sm" | "md" | "lg";
  isMe: boolean;
}) {
  if (!entry) {
    return (
      <div className="card-quiet p-3 text-center text-ink-500 text-xs">empty</div>
    );
  }
  const t = tierForElo(entry.classicElo);
  const tc = TIER_COLORS[t.name] ?? TIER_COLORS.Initiate;
  const accent =
    place === 1 ? "ring-2 ring-yellow-400/60 shadow-glow" :
    place === 2 ? "ring-2 ring-zinc-300/40" :
    "ring-2 ring-amber-700/40";
  const sizeClass =
    height === "lg" ? "pt-7 pb-6" :
    height === "md" ? "pt-5 pb-5" : "pt-4 pb-4";
  const medal = place === 1 ? "1st" : place === 2 ? "2nd" : "3rd";
  const medalColor =
    place === 1 ? "text-yellow-300" :
    place === 2 ? "text-zinc-200" : "text-amber-400";

  return (
    <div className={`card ${accent} ${sizeClass} px-3 text-center relative ${isMe ? "bg-clay/5" : ""}`}>
      <div className={`absolute top-2 left-2 text-[10px] uppercase tracking-widest font-bold ${medalColor}`}>{medal}</div>
      <Avatar username={entry.username} size={place === 1 ? "xl" : "lg"} self={isMe} ring={place === 1} />
      <div className="mt-2 font-semibold truncate text-sm">@{entry.username}</div>
      <div className={`mt-1 inline-block px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-widest ${tc.bg} ${tc.text}`}>
        {t.name}
      </div>
      <div className={`mt-2 font-bold tabular-nums ${place === 1 ? "text-3xl" : "text-2xl"}`}>
        {entry.classicElo}
      </div>
    </div>
  );
}
