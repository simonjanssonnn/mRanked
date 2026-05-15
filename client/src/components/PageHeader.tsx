import { useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";

// Shared top bar for every authenticated page. The avatar at the top-right
// opens a dropdown (Profile / Ranks / Leaderboard / Settings / Logout) rather
// than jumping straight to the profile page — new users couldn't guess that
// the bare avatar was a single navigation target.
export function PageHeader({ title }: { title: string }) {
  const navigate = useNavigate();

  return (
    <header className="px-6 py-4 flex items-center justify-between border-b border-cream-200/60 sticky top-0 z-10 bg-cream-50/85 backdrop-blur">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 hover:opacity-90 transition-opacity"
        aria-label="Home"
      >
        <Logo />
      </button>
      <div className="font-medium text-lg tracking-tight text-ink-900 hidden sm:block">{title}</div>
      <UserMenu compact />
    </header>
  );
}
