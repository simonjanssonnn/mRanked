import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../store/auth";
import { useGame } from "../store/game";
import { getSocket } from "../lib/socket";
import { Avatar } from "../components/Avatar";
import { Logo } from "../components/Logo";
import { TitleChip } from "../components/TitleChip";
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

  function playRanked() {
    game.reset();
    game.setPhase("queuing");
    getSocket().emit("queue:join", { mode: "classic" });
    navigate("/queue");
  }

  return (
    <div className="min-h-screen">
      <header className="px-6 py-4 flex items-center justify-between border-b border-cream-200/60">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          aria-label="Home"
        >
          <Logo />
        </button>
        <button
          onClick={() => navigate("/profile")}
          className="group flex items-center gap-3 rounded-full pl-3 pr-1.5 py-1.5 border border-cream-200/60 hover:border-clay/40 hover:bg-cream-100/40 transition-colors"
          aria-label="Open profile"
        >
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-ink-950 leading-tight flex items-center gap-1.5">
              @{user.username}
              <TitleChip titleId={user.equippedTitle} size="xs" />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-ink-500 tabular-nums">
              {tier.name} · {user.classicElo}
            </div>
          </div>
          <Avatar username={user.username} size="md" self ring />
        </button>
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
          onClick={playRanked}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="btn-primary w-full text-xl py-5 mt-6"
        >
          Play ranked · Best of 3
        </motion.button>
        <button
          onClick={() => navigate("/modes")}
          className="btn-ghost w-full text-base py-3 mt-3"
        >
          More modes & custom lobbies →
        </button>

        {/* Stats grid */}
        <div className="mt-10 grid grid-cols-4 gap-3">
          <Stat label="Matches" value={user.classicMatches} />
          <Stat label="Wins" value={user.classicWins} valueClass="text-good" />
          <Stat label="Losses" value={user.classicLosses} valueClass="text-bad" />
          <Stat label="Win %" value={winRate} suffix="%" />
        </div>

        {/* Navigation tiles — pulled out of a flat link list into discoverable cards */}
        <div className="mt-10 grid grid-cols-2 gap-3">
          <NavTile icon={IconLadder} title="Ranks" sub="See the climb" onClick={() => navigate("/ranks")} />
          <NavTile icon={IconCrown} title="Leaderboard" sub="Top players" onClick={() => navigate("/leaderboard")} />
          <NavTile icon={IconUser} title="Profile" sub="History & stats" onClick={() => navigate("/profile")} />
          <NavTile icon={IconGear} title="Settings" sub="Avatar, title, prefs" onClick={() => navigate("/settings")} />
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={() => logout()}
            className="text-xs uppercase tracking-widest text-ink-500 hover:text-bad transition-colors px-3 py-1.5"
          >
            Log out
          </button>
        </div>
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

function NavTile({ icon: Icon, title, sub, onClick }: {
  icon: (p: { className?: string }) => JSX.Element;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card p-4 flex items-center gap-3 text-left hover:border-clay/40 hover:shadow-glow transition-all group"
    >
      <div className="w-10 h-10 rounded-xl bg-cream-200/40 group-hover:bg-clay/15 flex items-center justify-center transition-colors">
        <Icon className="w-5 h-5 text-clay" />
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-ink-950">{title}</div>
        <div className="text-xs text-ink-600 truncate">{sub}</div>
      </div>
    </button>
  );
}

// Tiny inline icons — keeps the bundle lean (no icon dep).
function IconLadder({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3v18M17 3v18M7 8h10M7 13h10M7 18h10" />
    </svg>
  );
}
function IconCrown({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z" />
      <path d="M5 19h14" />
    </svg>
  );
}
function IconUser({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}
function IconGear({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
