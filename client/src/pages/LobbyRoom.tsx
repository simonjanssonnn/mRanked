import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useLobby } from "../store/lobby";
import { getSocket } from "../lib/socket";
import { Avatar } from "../components/Avatar";
import { MathBlock } from "../components/Math";
import { TimerRing } from "../components/TimerRing";
import { PageHeader } from "../components/PageHeader";
import { CLASSIC_TIERS } from "../lib/ranks";
import type { LobbyPlayer, LobbySettings } from "../lib/types";

export function LobbyRoom() {
  const { code } = useParams();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const view = useLobby((s) => s.view);
  const countdown = useLobby((s) => s.countdown);
  const problem = useLobby((s) => s.problem);
  const roundStartedAt = useLobby((s) => s.roundStartedAt);
  const yourSubmittedAt = useLobby((s) => s.yourSubmittedAt);
  const roundEnded = useLobby((s) => s.roundEnded);
  const complete = useLobby((s) => s.complete);
  const resetRoom = useLobby((s) => s.resetRoom);

  const [answer, setAnswer] = useState("");
  useEffect(() => { setAnswer(""); }, [problem?.id]);

  // If we land here without lobby state (e.g. direct URL paste), attempt to
  // join with the URL code. The server either confirms (re-broadcasts state)
  // or replies with "lobby:join_failed", at which point we bail back to the
  // join screen so the user can see the error.
  useEffect(() => {
    if (!view && code) {
      getSocket().emit("lobby:join", { code: code.toUpperCase() });
    }
    if (!view && !code) navigate("/modes", { replace: true });
  }, [view, code, navigate]);

  // Tell the server we're leaving when the user navigates away.
  function leaveLobby() {
    getSocket().emit("lobby:leave");
    resetRoom();
    navigate("/modes", { replace: true });
  }

  function submit(forced?: string) {
    if (yourSubmittedAt || !problem) return;
    const a = forced ?? answer;
    if (!a.trim() && !forced) return;
    getSocket().emit("lobby:answer", { answer: a });
    useLobby.getState().markYouSubmitted();
  }

  if (!user || !view) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-500">
        <div className="animate-pulse">Loading lobby {code}…</div>
      </div>
    );
  }

  const isHost = view.hostId === user.id;
  const inGame = view.state === "in_round" || view.state === "between_rounds";

  return (
    <div className="min-h-screen">
      <PageHeader title={`Lobby ${view.code}`} />
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Lobby header row */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-ink-500">Join code</div>
              <div className="font-mono text-2xl tracking-[0.3em] tabular-nums">{view.code}</div>
            </div>
            <button
              className="btn-ghost text-xs px-3 py-1.5"
              onClick={() => navigator.clipboard?.writeText(view.code)}
              title="Copy code"
            >
              Copy
            </button>
          </div>
          <div className="text-xs text-ink-600">
            {view.players.length}/10 players · {inGame ? `Round ${view.round}/${view.rounds}` : "Waiting"}
          </div>
          <button onClick={leaveLobby} className="text-xs text-ink-500 hover:text-bad">Leave</button>
        </div>

        {/* Body switches on lobby state */}
        {view.state === "waiting" && (
          <WaitingRoom view={view} isHost={isHost} settings={view.settings} />
        )}

        {view.state === "in_round" && problem && roundStartedAt && (
          <InRound
            view={view}
            problem={problem}
            roundStartedAt={roundStartedAt}
            countdown={countdown}
            yourSubmittedAt={yourSubmittedAt}
            answer={answer}
            setAnswer={setAnswer}
            submit={submit}
          />
        )}

        {view.state === "in_round" && countdown !== null && !roundStartedAt && (
          <div className="flex flex-col items-center pt-8">
            <div className="text-clay uppercase text-[10px] tracking-[0.3em] mb-3 font-semibold">
              Round {view.round} of {view.rounds}
            </div>
            <div className="text-[10rem] font-medium leading-none">{countdown}</div>
          </div>
        )}

        {view.state === "between_rounds" && roundEnded && (
          <RoundEndedView view={view} roundEnded={roundEnded} />
        )}

        {view.state === "complete" && complete && (
          <CompleteView complete={complete} />
        )}
      </main>
    </div>
  );
}

function WaitingRoom({ view, isHost, settings }: { view: ReturnType<typeof useLobby.getState>["view"]; isHost: boolean; settings: LobbySettings }) {
  if (!view) return null;

  function patchSettings(patch: Partial<LobbySettings>) {
    getSocket().emit("lobby:settings", { settings: patch });
  }
  function startMatch() {
    getSocket().emit("lobby:start");
  }
  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  return (
    <>
      {/* Players grid */}
      <section className="card p-5 mb-4">
        <div className="text-xs uppercase tracking-widest text-clay font-semibold mb-3">Players · {view.players.length}/10</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {view.players.map((p) => (
            <PlayerTile key={p.userId} player={p} isHost={p.userId === view.hostId} />
          ))}
          {Array.from({ length: Math.max(0, Math.min(10 - view.players.length, 5)) }).map((_, i) => (
            <div key={`empty-${i}`} className="card-quiet p-3 flex items-center justify-center text-[10px] uppercase tracking-widest text-ink-500">
              empty
            </div>
          ))}
        </div>
      </section>

      {/* Settings: editable if host, read-only otherwise */}
      <section className="card p-5 mb-4">
        <div className="text-xs uppercase tracking-widest text-clay font-semibold mb-3">
          {isHost ? "Settings (you're the host)" : "Settings"}
        </div>
        <SettingsBlock settings={settings} editable={isHost} onChange={patchSettings} toggle={toggle} />
      </section>

      {isHost ? (
        <button onClick={startMatch} disabled={view.players.length < 2} className="btn-primary w-full py-3 text-base">
          {view.players.length < 2 ? "Need at least 2 players" : "Start match"}
        </button>
      ) : (
        <div className="text-center text-sm text-ink-600 py-3">Waiting for host to start…</div>
      )}
    </>
  );
}

function SettingsBlock({ settings, editable, onChange, toggle }: {
  settings: LobbySettings;
  editable: boolean;
  onChange: (patch: Partial<LobbySettings>) => void;
  toggle: (list: string[], value: string) => string[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-sm text-ink-700">Rounds</div>
          <div className="font-medium tabular-nums">{settings.rounds}</div>
        </div>
        {editable ? (
          <input type="range" min={1} max={15} value={settings.rounds}
            onChange={(e) => onChange({ rounds: parseInt(e.target.value, 10) })}
            className="w-full accent-clay" />
        ) : (
          <div className="h-1.5 rounded-full bg-cream-200">
            <div className="h-full rounded-full bg-clay" style={{ width: `${(settings.rounds / 15) * 100}%` }} />
          </div>
        )}
      </div>
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-sm text-ink-700">Time per round</div>
          <div className="font-medium tabular-nums">{formatDuration(settings.timeLimitSec)}</div>
        </div>
        {editable ? (
          <input type="range" min={15} max={1800} step={5} value={Math.min(1800, settings.timeLimitSec)}
            onChange={(e) => onChange({ timeLimitSec: parseInt(e.target.value, 10) })}
            className="w-full accent-clay" />
        ) : (
          <div className="h-1.5 rounded-full bg-cream-200">
            <div className="h-full rounded-full bg-clay" style={{ width: `${Math.min(100, (settings.timeLimitSec / 1800) * 100)}%` }} />
          </div>
        )}
        {settings.timeLimitSec > 1800 && (
          <div className="text-[10px] text-ink-500 mt-1">Slider tops out at 30 min — current value: {formatDuration(settings.timeLimitSec)}. Recreate the lobby to set hours.</div>
        )}
      </div>
      <div>
        <div className="text-sm text-ink-700 mb-2">Difficulty tiers</div>
        <div className="flex flex-wrap gap-1.5">
          {CLASSIC_TIERS.map((t) => {
            const on = settings.tiers.includes(t.name);
            return (
              <button
                key={t.name}
                disabled={!editable}
                onClick={() => onChange({ tiers: toggle(settings.tiers, t.name) })}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  on ? "bg-clay text-cream-50 border-clay" : "border-cream-200 text-ink-700"
                } ${editable ? "" : "cursor-default"}`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatDuration(totalSec: number): string {
  if (totalSec >= 3600) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.round((totalSec % 3600) / 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  if (totalSec >= 60) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
  }
  return `${totalSec}s`;
}

function PlayerTile({ player, isHost }: { player: LobbyPlayer; isHost: boolean }) {
  return (
    <div className={`card-quiet p-3 flex flex-col items-center gap-1.5 ${player.connected ? "" : "opacity-50"}`}>
      <Avatar
        username={player.username}
        profile={{
          username: player.username,
          avatarColor: player.avatarColor,
          avatarInitials: player.avatarInitials,
          avatarImage: player.avatarImage,
          equippedTitle: player.equippedTitle,
        }}
        size="md"
      />
      <div className="text-xs font-medium truncate max-w-full">@{player.username}</div>
      {isHost && <span className="chip chip-clay">Host</span>}
    </div>
  );
}

function InRound({
  view, problem, roundStartedAt, yourSubmittedAt, answer, setAnswer, submit,
}: {
  view: NonNullable<ReturnType<typeof useLobby.getState>["view"]>;
  problem: NonNullable<ReturnType<typeof useLobby.getState>["problem"]>;
  roundStartedAt: number;
  countdown: number | null;
  yourSubmittedAt: number | null;
  answer: string;
  setAnswer: (s: string) => void;
  submit: (forced?: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-7">
      <TimerRing totalSec={problem.timeLimitSec} startedAt={roundStartedAt} frozen={!!yourSubmittedAt} />

      <div className="card-raised p-6 w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-[0.25em] text-clay font-semibold">
            Round {view.round} / {view.rounds} · {problem.tier}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-ink-500">
            {view.players.filter((p) => p.submitted).length}/{view.players.length} submitted
          </div>
        </div>
        <MathBlock className="text-2xl leading-relaxed">{problem.prompt}</MathBlock>
      </div>

      {yourSubmittedAt ? (
        <div className="card-quiet px-4 py-3 text-sm text-ink-700">
          <span className="chip chip-good mr-2">Locked in</span>
          Waiting for others…
        </div>
      ) : problem.answerType === "multiple_choice" ? (
        <div className="grid grid-cols-2 gap-3 w-full">
          {(problem.options ?? []).map((opt) => (
            <button key={opt} className="btn-ghost py-4 text-lg" onClick={() => submit(opt)}>
              <MathBlock>{opt}</MathBlock>
            </button>
          ))}
        </div>
      ) : (
        <div className="w-full flex gap-3">
          <input
            autoFocus
            className="input text-2xl text-center font-mono tabular-nums"
            placeholder="answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          />
          <button className="btn-primary text-lg px-6" onClick={() => submit()} disabled={!answer.trim()}>
            Submit
          </button>
        </div>
      )}

      <PlayerStatusStrip view={view} />
    </div>
  );
}

function PlayerStatusStrip({ view }: { view: NonNullable<ReturnType<typeof useLobby.getState>["view"]> }) {
  const sorted = [...view.players].sort((a, b) => b.score - a.score);
  return (
    <div className="w-full">
      <div className="text-[10px] uppercase tracking-widest text-ink-500 mb-2">Standings</div>
      <div className="flex flex-wrap gap-2">
        {sorted.map((p) => (
          <div key={p.userId} className={`card-quiet px-3 py-2 flex items-center gap-2 ${p.submitted ? "ring-1 ring-good/30" : ""}`}>
            <Avatar
              username={p.username}
              profile={{
                username: p.username,
                avatarColor: p.avatarColor,
                avatarInitials: p.avatarInitials,
                avatarImage: p.avatarImage,
                equippedTitle: p.equippedTitle,
              }}
              size="sm"
            />
            <span className="text-xs">@{p.username}</span>
            <span className="tabular-nums text-xs font-semibold">{p.score}</span>
            {p.submitted && <span className="w-1.5 h-1.5 rounded-full bg-good" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoundEndedView({ view, roundEnded }: {
  view: NonNullable<ReturnType<typeof useLobby.getState>["view"]>;
  roundEnded: NonNullable<ReturnType<typeof useLobby.getState>["roundEnded"]>;
}) {
  const sorted = [...roundEnded.players].sort((a, b) => b.score - a.score);
  return (
    <div className="space-y-4">
      <div className="card p-5 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-ink-500 mb-1">Round {roundEnded.round} of {roundEnded.rounds}</div>
        <div className="text-xs uppercase tracking-widest text-clay font-semibold mb-1">Correct answer</div>
        <div className="text-2xl mb-3"><MathBlock>{roundEnded.correctAnswer}</MathBlock></div>
        <div className="text-sm text-ink-700"><MathBlock>{roundEnded.solution}</MathBlock></div>
      </div>

      <div className="card p-5">
        <div className="text-xs uppercase tracking-widest text-clay font-semibold mb-3">Scoreboard</div>
        <div className="space-y-2">
          {sorted.map((p, i) => {
            const tone = p.correct ? "text-good" : "text-bad";
            return (
              <div key={p.userId} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-cream-100/50">
                <div className="w-8 text-center font-bold tabular-nums text-ink-700">#{i + 1}</div>
                <div className="flex-1 truncate text-sm">@{p.username}</div>
                <div className={`text-xs ${tone}`}>{p.correct ? "✓" : "✗"} {p.answer ?? "—"}</div>
                <div className="tabular-nums text-xs text-ink-600">
                  {p.timeMs == null ? "—" : `${(p.timeMs / 1000).toFixed(2)}s`}
                </div>
                <div className="tabular-nums font-semibold w-12 text-right">
                  +{p.pointsThisRound}
                </div>
                <div className="tabular-nums w-12 text-right text-clay">{p.score}</div>
              </div>
            );
          })}
        </div>
        <div className="text-[11px] text-ink-500 mt-3 text-center">
          {view.round < view.rounds ? "Next round in a moment…" : "Final round complete — tallying winner…"}
        </div>
      </div>
    </div>
  );
}

function CompleteView({ complete }: { complete: NonNullable<ReturnType<typeof useLobby.getState>["complete"]> }) {
  const winner = complete.final[0];
  return (
    <div className="space-y-4">
      <div className="card-raised p-8 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-good mb-2">Winner · {complete.rounds} rounds</div>
        <div className="flex justify-center mb-3">
          <Avatar
            username={winner.username}
            profile={{
              username: winner.username,
              avatarColor: winner.avatarColor,
              avatarInitials: winner.avatarInitials,
              avatarImage: winner.avatarImage,
              equippedTitle: winner.equippedTitle,
            }}
            size="xl"
            ring
          />
        </div>
        <div className="text-2xl font-medium">@{winner.username}</div>
        <div className="text-4xl font-medium tabular-nums mt-1">{winner.score} pts</div>
      </div>

      <div className="card p-5">
        <div className="text-xs uppercase tracking-widest text-clay font-semibold mb-3">Final standings</div>
        <div className="space-y-2">
          {complete.final.map((p, i) => (
            <div key={p.userId} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-cream-100/50">
              <div className="w-8 text-center font-bold tabular-nums text-ink-700">#{i + 1}</div>
              <Avatar
                username={p.username}
                profile={{
                  username: p.username,
                  avatarColor: p.avatarColor,
                  avatarInitials: p.avatarInitials,
                  avatarImage: p.avatarImage,
                  equippedTitle: p.equippedTitle,
                }}
                size="sm"
              />
              <div className="flex-1 truncate">@{p.username}</div>
              <div className="tabular-nums text-clay font-semibold">{p.score}</div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-ink-500 mt-3 text-center">Lobby will reset shortly — host can start another match.</div>
      </div>
    </div>
  );
}
