import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { Avatar } from "../components/Avatar";
import { tierForElo } from "../lib/ranks";

type Entry = {
  id: string;
  username: string;
  classicElo: number;
  classicMatches: number;
  classicWins: number;
  classicLosses: number;
};

export function Leaderboard() {
  const navigate = useNavigate();
  const me = useAuth((s) => s.user);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.leaderboard().then((d) => setEntries(d.entries)).catch((e) => setErr(String(e)));
  }, []);

  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 flex items-center justify-between border-b border-cream-200">
        <button className="btn-subtle text-sm" onClick={() => navigate("/", { replace: true })}>← Home</button>
        <div className="font-serif text-xl">Leaderboard</div>
        <span className="w-12" />
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {err && <div className="text-bad text-sm">{err}</div>}
        {!entries ? (
          <div className="text-ink-500 text-sm text-center py-12">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-ink-500 text-sm text-center py-12">No players yet. Be the first.</div>
        ) : (
          <div className="card overflow-hidden divide-y divide-cream-200">
            {entries.map((e, i) => {
              const isMe = me?.id === e.id;
              return (
                <div
                  key={e.id}
                  className={`px-4 py-3 flex items-center gap-4 ${isMe ? "bg-clay/5" : ""}`}
                >
                  <div className="w-8 text-right tabular-nums text-sm text-ink-600 font-semibold">
                    {i + 1}
                  </div>
                  <Avatar username={e.username} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      @{e.username}
                      {isMe && <span className="ml-2 text-[10px] uppercase tracking-widest text-clay">You</span>}
                    </div>
                    <div className="text-xs text-ink-600">
                      {tierForElo(e.classicElo).name} · {e.classicMatches} matches · {e.classicWins}W {e.classicLosses}L
                    </div>
                  </div>
                  <div className="text-2xl font-bold tabular-nums">{e.classicElo}</div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
