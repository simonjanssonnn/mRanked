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
    result.result === "draw" ? "Stalemate" : "Defeat";
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

  // Who was actually faster (only meaningful when both submitted).
  const bothSubmitted = result.yourTimeMs !== null && result.opponentTimeMs !== null;
  const youFaster = bothSubmitted && (result.yourTimeMs as number) < (result.opponentTimeMs as number);
  const opponentFaster = bothSubmitted && (result.opponentTimeMs as number) < (result.yourTimeMs as number);
  const timeDiffMs = bothSubmitted
    ? Math.abs((result.yourTimeMs as number) - (result.opponentTimeMs as number))
    : null;

  const youWon = result.result === "win";
  const opponentName = match?.opponent.username ?? "opponent";
  const winnerName = result.result === "draw" ? null : (youWon ? user.username : opponentName);
  const fastestName = !bothSubmitted ? null : (youFaster ? user.username : opponentName);

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      {/* Headline + ELO delta */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
        <div className={`text-xs uppercase tracking-[0.3em] mb-1 font-semibold ${headlineColor}`}>{headline}</div>
        <div className="font-serif text-7xl tabular-nums leading-none">
          <span className={result.eloDelta >= 0 ? "text-good" : "text-bad"}>{sign}{shown}</span>
        </div>
        <div className="mt-2 text-ink-700 text-sm">
          New rating <span className="font-semibold text-ink-950 tabular-nums">{result.newElo}</span>
          {" · "}{tierForElo(result.newElo).name}
        </div>
      </motion.div>

      {/* Winner + Fastest summary — always present so players see what happened. */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <SummaryCard
          icon="🏆"
          title="Winner"
          name={winnerName ?? "—"}
          subtitle={
            result.result === "draw"
              ? "Tie — no winner"
              : winnerName === user.username
                ? "You took the round"
                : `${opponentName} took the round`
          }
          highlight={winnerName === user.username}
        />
        <SummaryCard
          icon="⚡"
          title="Fastest"
          name={fastestName ?? "—"}
          subtitle={
            !bothSubmitted
              ? "Only one player submitted"
              : timeDiffMs !== null
                ? `Won the clock by ${(timeDiffMs / 1000).toFixed(2)}s`
                : "Tied to the millisecond"
          }
          highlight={fastestName === user.username}
        />
      </div>

      {/* Per-player breakdown */}
      <div className="card p-5 mb-4 grid grid-cols-2 gap-4 text-sm">
        <Side
          username={user.username}
          label="You"
          correct={result.youCorrect}
          accuracy={result.yourAccuracy}
          timeMs={result.yourTimeMs}
          answer={result.yourAnswer}
          faster={youFaster}
          winner={youWon}
          isSelf
        />
        <Side
          username={opponentName}
          label="Opponent"
          correct={result.opponentCorrect}
          accuracy={result.opponentAccuracy}
          timeMs={result.opponentTimeMs}
          answer={result.opponentAnswer}
          faster={opponentFaster}
          winner={result.result === "loss"}
        />
      </div>

      <div className="text-[11px] text-ink-500 text-center mb-6 px-2">
        Tiebreak rule: when both are correct (or both wrong), the faster submission wins.
      </div>

      <div className="card p-6 mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-clay font-semibold mb-2">Correct answer</div>
        <div className="text-2xl mb-4"><MathBlock>{result.correctAnswer}</MathBlock></div>
        <div className="text-xs uppercase tracking-[0.25em] text-clay font-semibold mb-2">Solution</div>
        <MathBlock className="text-ink-800 leading-relaxed">{result.solution}</MathBlock>
      </div>

      <div className="flex gap-3">
        <button className="btn-ghost flex-1 py-3" onClick={home}>Home</button>
        <button className="btn-primary flex-1 py-3" onClick={rematch}>Play again</button>
      </div>
    </div>
  );
}

function SummaryCard({ icon, title, name, subtitle, highlight }: {
  icon: string; title: string; name: string; subtitle: string; highlight: boolean;
}) {
  return (
    <div className={`card p-4 ${highlight ? "ring-1 ring-clay/40 shadow-glow" : ""}`}>
      <div className="text-[10px] uppercase tracking-widest text-ink-500 mb-1">{title}</div>
      <div className="flex items-center gap-2">
        <span className="text-xl leading-none">{icon}</span>
        <span className={`font-semibold truncate ${highlight ? "text-clay" : "text-ink-950"}`}>
          @{name}
        </span>
      </div>
      <div className="text-xs text-ink-600 mt-1">{subtitle}</div>
    </div>
  );
}

function Side({ username, label, correct, accuracy, timeMs, answer, faster, winner, isSelf = false }: {
  username: string;
  label: string;
  correct: boolean;
  accuracy: number;
  timeMs: number | null;
  answer: string | null;
  faster: boolean;
  winner: boolean;
  isSelf?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Avatar username={username} size="sm" self={isSelf} />
        <div className="text-[10px] uppercase tracking-widest text-ink-600">{label}</div>
        <div className="ml-auto flex gap-1">
          {winner && <span className="chip-good">Won</span>}
          {faster && <span className="chip-clay">Fastest</span>}
        </div>
      </div>
      <div className={`font-medium ${correct ? "text-good" : "text-bad"}`}>{correct ? "Correct" : "Incorrect"}</div>
      <div className="text-ink-700 mt-1">Accuracy <span className="text-ink-950 tabular-nums">{Math.round(accuracy * 100)}%</span></div>
      <div className="text-ink-700">
        Time{" "}
        <span className={`tabular-nums font-semibold ${faster ? "text-clay" : "text-ink-950"}`}>
          {timeMs === null ? "—" : `${(timeMs / 1000).toFixed(2)}s`}
        </span>
      </div>
      <div className="text-ink-500 text-xs mt-1 break-all">{answer ? <>Answer: <span className="text-ink-800">{answer}</span></> : <em>none</em>}</div>
    </div>
  );
}
