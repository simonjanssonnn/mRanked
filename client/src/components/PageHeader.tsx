import { useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import { useAuth } from "../store/auth";

// Shared top bar for every authenticated page.
// - Logo on the left goes home.
// - Avatar on the right always goes to /profile (the user asked for this).
// - Optional title slot in the centre identifies the page.
export function PageHeader({ title }: { title: string }) {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  return (
    <header className="px-6 py-4 flex items-center justify-between border-b border-cream-200/60 sticky top-0 z-10 bg-cream-50/85 backdrop-blur">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 hover:opacity-90 transition-opacity"
        aria-label="Home"
      >
        <Logo />
      </button>
      <div className="font-serif text-lg tracking-tight text-ink-900 hidden sm:block">{title}</div>
      {user ? (
        <button
          onClick={() => navigate("/profile")}
          aria-label="Open profile"
          className="flex items-center gap-2 rounded-full pl-2.5 pr-1 py-1 border border-cream-200/60 hover:border-clay/40 hover:bg-cream-100/40 transition-colors"
        >
          <span className="hidden sm:inline text-xs uppercase tracking-widest text-ink-600">
            @{user.username}
          </span>
          <Avatar username={user.username} size="sm" self />
        </button>
      ) : (
        <span className="w-12" />
      )}
    </header>
  );
}
