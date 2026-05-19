import { useNavigate } from "react-router-dom";
import { useGame } from "../store/game";
import { getSocket } from "../lib/socket";
import { PageHeader } from "../components/PageHeader";

export function Modes() {
  const navigate = useNavigate();
  const game = useGame();

  function playRanked() {
    game.reset();
    game.setPhase("queuing");
    getSocket().emit("queue:join", { mode: "classic" });
    navigate("/queue");
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Play" />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <div className="text-[10px] uppercase tracking-[0.3em] text-ink-500 mb-2">Choose a mode</div>
          <h1 className="text-3xl font-medium tracking-tight">How do you want to play?</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModeCard
            badge="Ranked"
            title="Classic 1v1"
            subtitle="Best of 3 against a similarly rated opponent. Affects your ELO."
            cta="Play ranked"
            onClick={playRanked}
            accent="primary"
          />
          <ModeCard
            badge="Custom"
            title="Practice (solo)"
            subtitle="A single problem at any difficulty. No ELO impact."
            cta="Start practice"
            onClick={() => navigate("/practice")}
            accent="ghost"
          />
          <ModeCard
            badge="Lobby"
            title="Create a lobby"
            subtitle="Host a free-for-all with up to 10 friends. Set the rules."
            cta="Create lobby"
            onClick={() => navigate("/lobby/new")}
            accent="primary"
          />
          <ModeCard
            badge="Lobby"
            title="Join a lobby"
            subtitle="Got a 6-character code from a friend? Drop in."
            cta="Enter code"
            onClick={() => navigate("/lobby/join")}
            accent="ghost"
          />
          <ModeCard
            badge="Custom"
            title="Tournament"
            subtitle="Single-elimination bracket of 4, 8, or 16. Winners advance until one stands."
            cta="Create bracket"
            onClick={() => navigate("/tournament/new")}
            accent="primary"
          />
        </div>
      </main>
    </div>
  );
}

function ModeCard({ badge, title, subtitle, cta, onClick, accent }: {
  badge: string;
  title: string;
  subtitle: string;
  cta: string;
  onClick: () => void;
  accent: "primary" | "ghost";
}) {
  return (
    <button
      onClick={onClick}
      className="card text-left p-6 hover:border-clay/40 transition-colors group"
    >
      <div className="chip chip-clay mb-3">{badge}</div>
      <div className="text-xl font-semibold mb-2">{title}</div>
      <div className="text-sm text-ink-700 mb-5">{subtitle}</div>
      <span className={accent === "primary" ? "btn-primary text-sm px-4 py-2" : "btn-ghost text-sm px-4 py-2"}>
        {cta} →
      </span>
    </button>
  );
}
