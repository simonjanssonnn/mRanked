import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useGame } from "../store/game";
import { useAuth } from "../store/auth";
import { getSocket } from "../lib/socket";
import { Avatar } from "../components/Avatar";
import { tierForElo } from "../lib/ranks";

const TIPS = [
  "Both correct? The faster submission wins.",
  "Multiple-choice problems still count: speed + accuracy.",
  "Provisional players (under 10 matches) gain or lose rating faster.",
  "Closing the tab forfeits the match after a brief grace period.",
  "Higher tiers unlock harder problems — and bigger swings.",
  "Use $\\LaTeX$-style answers when prompted, e.g. 1/2 not 0.5.",
];

export function Queue() {
  const phase = useGame((s) => s.phase);
  const searchRange = useGame((s) => s.searchRange);
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const [secs, setSecs] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSecs((n) => n + 1), 1000);
    const tipT = setInterval(() => setTipIdx((n) => (n + 1) % TIPS.length), 5000);
    return () => { clearInterval(t); clearInterval(tipT); };
  }, []);

  useEffect(() => {
    if (phase === "idle") navigate("/", { replace: true });
  }, [phase, navigate]);

  function cancel() {
    getSocket().emit("queue:leave");
    useGame.getState().setPhase("idle");
    navigate("/", { replace: true });
  }

  const tier = user ? tierForElo(user.classicElo) : null;
  const eloLow = user ? Math.max(0, user.classicElo - searchRange) : 0;
  const eloHigh = user ? user.classicElo + searchRange : 0;

  // Three concentric ripple delays
  const ripples = useMemo(() => [0, 0.6, 1.2], []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="text-center w-full max-w-md">
        <div className="text-clay uppercase text-xs tracking-[0.3em] mb-6 font-semibold">Finding an opponent</div>

        <div className="relative h-44 w-44 mx-auto mb-8">
          {ripples.map((delay, i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border border-clay/40"
              animate={{ scale: [0.6, 1.4], opacity: [0.6, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, delay, ease: "easeOut" }}
            />
          ))}
          <div className="absolute inset-4 rounded-full bg-cream-100/60 border border-cream-300 flex items-center justify-center">
            {user && <Avatar username={user.username} size="xl" self ring />}
          </div>
        </div>

        {user && tier && (
          <>
            <div className="font-serif text-3xl tabular-nums">{user.classicElo}</div>
            <div className="text-sm text-clay font-medium">{tier.name}</div>
          </>
        )}

        {/* ELO search range visualizer */}
        <div className="mt-7 card-quiet p-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-ink-500 mb-2">
            <span>search range</span>
            <span className="tabular-nums">±{searchRange}</span>
          </div>
          <div className="relative h-2 rounded-full bg-cream-200 overflow-hidden">
            <motion.div
              key={searchRange}
              className="absolute inset-y-0 bg-gradient-to-r from-clay/70 via-clay to-violet/70"
              initial={{ left: "50%", right: "50%" }}
              animate={{ left: "0%", right: "0%" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{ borderRadius: 999 }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-ink-600 mt-2 tabular-nums">
            <span>{eloLow}</span>
            <span>{eloHigh}</span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-4 text-xs text-ink-600">
          <span className="tabular-nums">{secs}s elapsed</span>
          <span className="text-ink-400">·</span>
          <span>Widens every 2s</span>
        </div>

        {/* Rotating helpful tip — fills the wait time with something useful, Brilliant-style */}
        <motion.div
          key={tipIdx}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-8 text-sm text-ink-700 italic"
        >
          “{TIPS[tipIdx]}”
        </motion.div>

        <button onClick={cancel} className="btn-ghost mt-10 px-8">Cancel</button>
      </motion.div>
    </div>
  );
}
