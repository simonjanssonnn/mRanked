import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSocket } from "../lib/socket";
import { useLobby } from "../store/lobby";
import { PageHeader } from "../components/PageHeader";

const REASONS: Record<string, string> = {
  no_such_lobby: "No lobby with that code.",
  in_progress: "That lobby has already started.",
  lobby_full: "The lobby is full (max 10).",
};

export function LobbyJoin() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const joinError = useLobby((s) => s.joinError);
  const setJoinError = useLobby((s) => s.setJoinError);

  useEffect(() => () => setJoinError(null), [setJoinError]);

  function join() {
    setJoinError(null);
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) return;
    getSocket().emit("lobby:join", { code: clean });
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Join lobby" />
      <main className="max-w-md mx-auto px-6 py-16 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-ink-500 mb-2">Custom lobby</div>
        <h1 className="text-3xl font-medium tracking-tight mb-6">Enter join code</h1>

        <input
          className="input text-3xl text-center tracking-[0.4em] font-mono uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\s/g, "").slice(0, 6))}
          onKeyDown={(e) => { if (e.key === "Enter") join(); }}
          placeholder="ABC123"
          maxLength={6}
          autoFocus
        />

        {joinError && (
          <div className="text-bad text-sm mt-3">{REASONS[joinError] ?? joinError}</div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={() => navigate("/modes")} className="btn-ghost flex-1 py-3">Cancel</button>
          <button onClick={join} disabled={code.length < 4} className="btn-primary flex-1 py-3">Join</button>
        </div>
      </main>
    </div>
  );
}
