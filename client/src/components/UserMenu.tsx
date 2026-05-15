import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { Avatar } from "./Avatar";
import { tierForElo } from "../lib/ranks";

// Top-right account menu used by the page header. Clicking the avatar opens
// a Material-style menu with quick links instead of jumping straight to the
// profile page (which was confusing — most apps put account options behind a
// dropdown, not a single navigation target).
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return <span className="w-12" />;
  const tier = tierForElo(user.classicElo);

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }
  async function doLogout() {
    setOpen(false);
    await logout();
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={`group flex items-center rounded-full border transition-colors ${
          open ? "border-clay/40 bg-cream-100/40" : "border-cream-200/60 hover:border-clay/40 hover:bg-cream-100/40"
        } ${compact ? "pl-2 pr-1 py-1 gap-2" : "pl-3 pr-1.5 py-1.5 gap-3"}`}
      >
        {!compact && (
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-ink-950 leading-tight">@{user.username}</div>
            <div className="text-[10px] uppercase tracking-widest text-ink-500 tabular-nums">
              {tier.name} · {user.classicElo}
            </div>
          </div>
        )}
        {compact && (
          <span className="hidden sm:inline text-xs uppercase tracking-widest text-ink-600">@{user.username}</span>
        )}
        <Avatar username={user.username} size={compact ? "sm" : "md"} self ring={!compact} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 card overflow-hidden z-50 origin-top-right"
        >
          <div className="px-4 py-3 border-b border-cream-200 flex items-center gap-3">
            <Avatar username={user.username} size="sm" self />
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">@{user.username}</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-500 tabular-nums">
                {tier.name} · {user.classicElo}
              </div>
            </div>
          </div>
          <MenuItem icon={IconUser} label="Profile" onClick={() => go("/profile")} />
          <MenuItem icon={IconLadder} label="Ranks" onClick={() => go("/ranks")} />
          <MenuItem icon={IconCrown} label="Leaderboard" onClick={() => go("/leaderboard")} />
          <div className="h-px bg-cream-200" />
          <MenuItem icon={IconGear} label="Settings" onClick={() => go("/settings")} />
          <MenuItem icon={IconLogout} label="Log out" onClick={doLogout} danger />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: {
  icon: (p: { className?: string }) => JSX.Element;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`w-full px-4 py-2.5 flex items-center gap-3 text-sm text-left transition-colors ${
        danger ? "text-bad hover:bg-bad/10" : "text-ink-900 hover:bg-cream-200/40"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

// Inline icons — kept here so the menu is self-contained.
function IconUser({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}
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
      <path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z" /><path d="M5 19h14" />
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
function IconLogout({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
