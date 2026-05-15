import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useGame } from "../store/game";
import { useAuth } from "../store/auth";
import { MathBlock } from "../components/Math";
import { getSocket } from "../lib/socket";
import { Avatar } from "../components/Avatar";
import { tierForElo } from "../lib/ranks";

export function Result() {
  const result = useGame((s) => s.result);
  const match = useGame((s) => s.match);
  const user = useAuth((s) => s.user);
  const reset = useGame((s) => s.reset);
  const navigate = useNavigate();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!result) return;
    const target = result.eloDelta;
    const start = performance.now();
    let raf = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / 900);
      setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [result]);

  if (!result || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button className="btn-primary" onClick={() => navigate("/", { replace: true })}>Home</button>
      </div>
    );
  }

  const headline =
    result.result === "win" ? "Victory" :
    result.result === "draw" ? "Draw" : "Defeat";
  const headlineColor =
    result.result === "win" ? "text-good" :
    result.result === "draw" ? "text-ink-700" : "text-bad";
  const sign = result.eloDelta > 0 ? "+" : "";

  function home() { reset(); navigate("/", { replace: true }); }
  function rematch() {
    reset();
    getSocket().emit("queue:join", { mode: "classic" });
    useGame.getState().setPhase("queuing");
    navigate("/queue", { replace: true });
  }

  const opponentName = match?.opponent.username ?? "opponent";
  const score = result.score ?? { you: 0, opponent: 0 };
  const rounds = result.rounds ?? [];

  // Subtitle context
  const subtitle =
    result.result === "draw"
      ? "Equal round wins — no one takes the match"
      : result.result === "win"
      ? `You took ${score.you} of ${rounds.length || "the"} rounds`
      : `${opponentName} took ${score.opponent} of ${rounds.length || "the"} rounds`;

  return (
    <div className="min-h-screen px-6 py-10 max-w-3xl mx-auto">
      {/* Headline + ELO delta */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
        <div className={`text-xs uppercase tracking-[0.3em] mb-1 font-semibold ${headlineColor}`}>{headline}</div>
        <div className="font-serif text-7xl tabular-nums leading-none">
          <span className={result.eloDelta > 0 ? "text-good" : result.eloDelta < 0 ? "text-bad" : "text-ink-700"}>{sign}{shown}</span>
        </div>
        <div className="mt-2 text-ink-700 text-sm">
          New rating <span className="font-semibold text-ink-950 tabular-nums">{result.newElo}</span>
          {" · "}{tierForElo(result.newElo).name}
        </div>
        <div className="text-xs text-ink-500 mt-2">{subtitle}</div>
      </motion.div>

      {/* Scoreboard */}
      <div className="card-raised p-5 mb-5">
        <div className="grid grid-cols-3 items-center gap-3">
          <div className="text-center">
            <Avatar username={user.username} size="lg" self />
            <div className="mt-1 font-semibold truncate">@{user.username}</div>
            <div className="text-xs text-ink-600">{tierForElo(result.newElo).name}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-ink-500 mb-1">Final score</div>
            <div className="font-serif text-5xl tabular-nums">
              <span className={result.result === "win" ? "text-good" : result.result === "loss" ? "text-ink-400" : "text-ink-700"}>{score.you}</span>
              <span className="text-ink-400 mx-2">–</span>
              <span className={result.result === "loss" ? "text-bad" : result.result === "win" ? "text-ink-400" : "text-ink-700"}>{score.opponent}</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-ink-500 mt-1">Best of {rounds.length || 3}</div>
          </div>
          <div className="text-center">
            <Avatar username={opponentName} size="lg" profile={match?.opponent} />
            <div className="mt-1 font-semibold truncate">@{opponentName}</div>
            <div className="text-xs text-ink-600">{match?.opponent.rank}</div>
          </div>
        </div>
      </div>

      {/* Per-round breakdown */}
      {rounds.length > 0 && (
        <div className="card p-5 mb-5">
          <div className="text-xs uppercase tracking-[0.25em] text-clay font-semibold mb-3">Round-by-round</div>
          <div className="space-y-3">
            {rounds.map((r, i) => (
              <RoundLine key={i} index={i + 1} r={r} opponentName={opponentName} />
            ))}
          </div>
        </div>
      )}

      {/* Last round's correct answer + solution (kept for the worked solution) */}
      <div className="card p-6 mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-clay font-semibold mb-2">Final round · solution</div>
        <div className="text-2xl mb-4"><MathBlock>{result.correctAnswer}</MathBlock></div>
        <MathBlock className="text-ink-800 leading-relaxed">{result.solution}</MathBlock>
      </div>

      <div className="flex gap-3">
        <button className="btn-ghost flex-1 py-3" onClick={home}>Home</button>
        <button className="btn-primary flex-1 py-3" onClick={rematch}>Play again</button>
      </div>
    </div>
  );
}

function RoundLine({ index, r, opponentName }: {
  index: number;
  r: NonNullable<ReturnType<typeof useGame.getState>["result"]>["rounds"][number];
  opponentName: string;
}) {
  const dot =
    r.result === "win" ? "bg-good" :
    r.result === "loss" ? "bg-bad" :
    "bg-ink-400";
  const label =
    r.result === "win" ? "Won" :
    r.result === "loss" ? "Lost" :
    "Drew";
  const labelColor =
    r.result === "win" ? "text-good" :
    r.result === "loss" ? "text-bad" :
    "text-ink-700";
  return (
    <div className="border border-cream-200 rounded-xl p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
          <span className="text-[10px] uppercase tracking-widest text-ink-500">Round {index}</span>
          <span className={`text-sm font-semibold ${labelColor}`}>{label}</span>
        </div>
        <div className="flex items-center gap-3 text-xs tabular-nums text-ink-700">
          <span>You {r.yourTimeMs == null ? "—" : `${(r.yourTimeMs / 1000).toFixed(2)}s`}</span>
          <span className="text-ink-400">·</span>
          <span>@{opponentName} {r.opponentTimeMs == null ? "—" : `${(r.opponentTimeMs / 1000).toFixed(2)}s`}</span>
        </div>
      </div>
      <MathBlock className="text-sm text-ink-900 leading-relaxed">{r.problemPrompt}</MathBlock>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <Field label="Correct" value={r.correctAnswer} tone="muted" />
        <Field label="Your answer" value={r.yourAnswer ?? "—"} tone={r.youCorrect ? "good" : "bad"} />
        <Field label="Opponent" value={r.opponentAnswer ?? "—"} tone={r.opponentCorrect ? "good" : "bad"} />
      </div>
    </div>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" | "muted" }) {
  const color = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-ink-700";
  return (
    <div className="card-quiet p-2">
      <div className="text-[10px] uppercase tracking-widest text-ink-500">{label}</div>
      <div className={`text-sm break-all ${color}`}>{value}</div>
    </div>
  );
}
