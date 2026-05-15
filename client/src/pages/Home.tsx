import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../store/auth";
import { useGame } from "../store/game";
import { getSocket } from "../lib/socket";
import { Avatar } from "../components/Avatar";
import { CLASSIC_TIERS, TIER_COLORS, tierForElo } from "../lib/ranks";

export function Home() {
  const { user, logout } = useAuth();
  const game = useGame();
  const navigate = useNavigate();

  if (!user) return null;
  const tier = tierForElo(user.classicElo);
  const tierColors = TIER_COLORS[tier.name] ?? TIER_COLORS.Initiate;
  const winRate = user.classicMatches > 0 ? Math.round((user.classicWins / user.classicMatches) * 100) : 0;

  // Progress within the current tier.
  const tierMin = tier.min;
  const tierMax = tier.max === Infinity ? tier.min + 400 : tier.max;
  const tierProgress = Math.max(0, Math.min(1, (user.classicElo - tierMin) / (tierMax - tierMin)));
  const nextTier = CLASSIC_TIERS[CLASSIC_TIERS.findIndex((t) => t.name === tier.name) + 1];

  function play() {
    game.reset();
    game.setPhase("queuing");
    getSocket().emit("queue:join", { mode: "classic" });
    navigate("/queue");
  }

  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 flex items-center justify-between border-b border-cream-200/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-clay to-violet flex items-center justify-center font-serif font-bold text-cream-50">∑</div>
          <div className="font-serif text-xl tracking-tight">Math Ranked</div>
        </div>
        <div className="flex items-center gap-3">
          <Avatar username={user.username} size="md" self />
          <span className="text-sm text-ink-700 hidden sm:inline">@{user.username}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pt-12 pb-24">
        {/* Hero rating card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-raised p-8 text-center"
        >
          <div className="text-xs uppercase tracking-[0.3em] text-ink-600 mb-3 font-semibold">Classic rating</div>
          <div className="font-serif text-8xl tabular-nums text-shimmer leading-none">{user.classicElo}</div>
          <div className={`inline-flex items-center gap-2 mt-4 px-3 py-1 rounded-full ring-1 ${tierColors.ring} ${tierColors.bg}`}>
            <span className={`text-sm font-semibold ${tierColors.text}`}>{tier.name}</span>
          </div>

          {/* Tier progress bar */}
          <div className="mt-6">
            <div className="flex justify-between text-[10px] uppercase tracking-widest text-ink-500 mb-1.5 tabular-nums">
              <span>{tierMin}</span>
              <span>{nextTier ? `Next: ${nextTier.name}` : "Apex tier"}</span>
              <span>{tier.max === Infinity ? "∞" : tier.max + 1}</span>
            </div>
            <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${tierProgress * 100}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-clay to-violet"
              />
            </div>
            {nextTier && (
              <div className="text-xs text-ink-600 mt-2 tabular-nums">
                {tier.max - user.classicElo + 1} to {nextTier.name}
              </div>
            )}
          </div>
        </motion.div>

        {/* CTAs */}
        <motion.button
          onClick={play}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="btn-primary w-full text-xl py-5 mt-6"
        >
          Play ranked
        </motion.button>
        <button
          onClick={() => navigate("/practice")}
          className="btn-ghost w-full text-base py-3 mt-3"
        >
          Practice (singleplayer)
        </button>

        {/* Stats grid */}
        <div className="mt-10 grid grid-cols-4 gap-3">
          <Stat label="Matches" value={user.classicMatches} />
          <Stat label="Wins" value={user.classicWins} valueClass="text-good" />
          <Stat label="Losses" value={user.classicLosses} valueClass="text-bad" />
          <Stat label="Win %" value={winRate} suffix="%" />
        </div>

        <nav className="mt-10 flex items-center justify-center gap-2 text-sm flex-wrap">
          <NavLink onClick={() => navigate("/ranks")}>Ranks</NavLink>
          <Dot />
          <NavLink onClick={() => navigate("/leaderboard")}>Leaderboard</NavLink>
          <Dot />
          <NavLink onClick={() => navigate("/profile")}>Profile</NavLink>
          <Dot />
          <NavLink onClick={() => navigate("/settings")}>Settings</NavLink>
          <Dot />
          <NavLink onClick={() => logout()}>Log out</NavLink>
        </nav>
      </main>
    </div>
  );
}

function Stat({ label, value, valueClass, suffix }: { label: string; value: number; valueClass?: string; suffix?: string }) {
  return (
    <div className="card-quiet p-4 text-center">
      <div className={`text-2xl font-bold tabular-nums ${valueClass ?? "text-ink-950"}`}>
        {value}{suffix ?? ""}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-ink-600 mt-1">{label}</div>
    </div>
  );
}

function NavLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button className="text-ink-600 hover:text-clay transition-colors px-1" onClick={onClick}>{children}</button>;
}
function Dot() { return <span className="text-ink-400">·</span>; }
