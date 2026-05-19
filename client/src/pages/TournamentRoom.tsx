import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useTournament } from "../store/tournament";
import { getSocket } from "../lib/socket";
import { Avatar } from "../components/Avatar";
import { MathBlock } from "../components/Math";
import { TimerRing } from "../components/TimerRing";
import { PageHeader } from "../components/PageHeader";
import type { TournamentMatch, TournamentPlayer, TournamentView } from "../lib/types";

export function TournamentRoom() {
  const { code } = useParams();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const view = useTournament((s) => s.view);
  const countdown = useTournament((s) => s.countdown);
  const problem = useTournament((s) => s.problem);
  const gameStartedAt = useTournament((s) => s.gameStartedAt);
  const yourSubmittedAt = useTournament((s) => s.yourSubmittedAt);
  const lastGameEnded = useTournament((s) => s.lastGameEnded);
  const lastMatchOver = useTournament((s) => s.lastMatchOver);
  const complete = useTournament((s) => s.complete);
  const roomError = useTournament((s) => s.roomError);
  const setRoomError = useTournament((s) => s.setRoomError);
  const resetRoom = useTournament((s) => s.resetRoom);

  const [answer, setAnswer] = useState("");
  useEffect(() => { setAnswer(""); }, [problem?.id]);

  useEffect(() => {
    if (!view && code) {
      getSocket().emit("tournament:join", { code: code.toUpperCase() });
    }
    if (!view && !code) navigate("/modes", { replace: true });
  }, [view, code, navigate]);

  const playerMap = useMemo(() => {
    const m = new Map<string, TournamentPlayer>();
    if (view) for (const p of view.players) m.set(p.userId, p);
    return m;
  }, [view]);

  function leave() {
    getSocket().emit("tournament:leave");
    resetRoom();
    navigate("/modes", { replace: true });
  }

  function submit(forced?: string) {
    if (yourSubmittedAt || !problem) return;
    const a = forced ?? answer;
    if (!a.trim() && !forced) return;
    getSocket().emit("tournament:answer", { answer: a });
    useTournament.getState().markYouSubmitted();
  }

  if (!user || !view) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-500">
        <div className="animate-pulse">Loading tournament {code}…</div>
      </div>
    );
  }

  const isHost = view.hostId === user.id;

  const currentMatch = view.bracket.find((m) => m.id === view.currentMatchId) ?? null;
  const youInMatch = !!currentMatch && (currentMatch.aId === user.id || currentMatch.bId === user.id);

  return (
    <div className="min-h-screen">
      <PageHeader title={`Tournament ${view.code}`} />
      <main className="max-w-5xl mx-auto px-6 py-8">
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
            {view.players.length}/{view.bracketSize} players · Bo{view.bestOf}
          </div>
          <button onClick={leave} className="text-xs text-ink-500 hover:text-bad">Leave</button>
        </div>

        {roomError && (
          <div className="card border-bad/40 bg-bad/10 p-3 mb-4 flex items-start gap-3">
            <span className="chip chip-bad shrink-0">Error</span>
            <div className="flex-1 text-sm text-ink-900">{roomError.message ?? roomError.code}</div>
            <button onClick={() => setRoomError(null)} className="text-ink-500 hover:text-ink-900 text-xs px-2">✕</button>
          </div>
        )}

        {view.state === "waiting" && (
          <WaitingRoom view={view} isHost={isHost} />
        )}

        {view.state !== "waiting" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <div>
              {view.state === "match_intro" && currentMatch && (
                <MatchIntro view={view} match={currentMatch} playerMap={playerMap} />
              )}
              {view.state === "in_game" && problem && gameStartedAt && currentMatch && (
                <InGame
                  view={view}
                  match={currentMatch}
                  problem={problem}
                  gameStartedAt={gameStartedAt}
                  yourSubmittedAt={yourSubmittedAt}
                  youInMatch={youInMatch}
                  playerMap={playerMap}
                  answer={answer}
                  setAnswer={setAnswer}
                  submit={submit}
                />
              )}
              {view.state === "in_game" && countdown !== null && !gameStartedAt && currentMatch && (
                <CountdownView view={view} match={currentMatch} countdown={countdown} playerMap={playerMap} />
              )}
              {view.state === "in_game" && !problem && !gameStartedAt && countdown === null && currentMatch && (
                <div className="card p-8 text-center text-ink-700">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-clay mb-2">Game {view.currentGame}</div>
                  <div className="text-lg">Loading problem…</div>
                </div>
              )}
              {view.state === "between_games" && lastGameEnded && currentMatch && (
                <GameEndedView lastGameEnded={lastGameEnded} match={currentMatch} playerMap={playerMap} bestOf={view.bestOf} />
              )}
              {view.state === "match_over" && lastMatchOver && (
                <MatchOverView lastMatchOver={lastMatchOver} playerMap={playerMap} />
              )}
              {view.state === "complete" && complete && (
                <CompleteView championId={complete.championId} playerMap={playerMap} />
              )}
            </div>
            <div className="lg:sticky lg:top-6 self-start">
              <BracketView view={view} playerMap={playerMap} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function WaitingRoom({ view, isHost }: { view: TournamentView; isHost: boolean }) {
  function start() { getSocket().emit("tournament:start"); }
  return (
    <>
      <section className="card p-5 mb-4">
        <div className="text-xs uppercase tracking-widest text-clay font-semibold mb-3">
          Players · {view.players.length}/{view.bracketSize}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {view.players.map((p) => (
            <PlayerTile key={p.userId} player={p} isHost={p.userId === view.hostId} />
          ))}
          {Array.from({ length: Math.max(0, view.bracketSize - view.players.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="card-quiet p-3 flex items-center justify-center text-[10px] uppercase tracking-widest text-ink-500">
              bye
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5 mb-4">
        <div className="text-xs uppercase tracking-widest text-clay font-semibold mb-3">Settings</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-ink-500">Bracket</div>
            <div className="font-medium">{view.settings.bracketSize} players</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-ink-500">Format</div>
            <div className="font-medium">Bo{view.settings.bestOf}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-ink-500">Time/game</div>
            <div className="font-medium">{view.settings.timeLimitSec}s</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-ink-500">Tiers</div>
            <div className="font-medium truncate">{view.settings.tiers.join(", ") || "any"}</div>
          </div>
        </div>
      </section>

      {isHost ? (
        <button onClick={start} disabled={view.players.length < 2} className="btn-primary w-full py-3 text-base">
          {view.players.length < 2 ? "Need at least 2 players" : "Start bracket"}
        </button>
      ) : (
        <div className="text-center text-sm text-ink-600 py-3">Waiting for host to start…</div>
      )}
    </>
  );
}

function PlayerTile({ player, isHost }: { player: TournamentPlayer; isHost: boolean }) {
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

function MatchIntro({ view, match, playerMap }: {
  view: TournamentView;
  match: TournamentMatch;
  playerMap: Map<string, TournamentPlayer>;
}) {
  const a = match.aId ? playerMap.get(match.aId) : null;
  const b = match.bId ? playerMap.get(match.bId) : null;
  return (
    <div className="card-raised p-8 text-center">
      <div className="text-[10px] uppercase tracking-[0.3em] text-clay mb-4">
        Round {match.round} · Match {match.index + 1} · Bo{view.bestOf}
      </div>
      <div className="flex items-center justify-center gap-8 mb-4">
        <PlayerLarge player={a} />
        <div className="text-3xl text-ink-500 font-medium">vs</div>
        <PlayerLarge player={b} />
      </div>
      <div className="text-sm text-ink-700">Get ready…</div>
    </div>
  );
}

function PlayerLarge({ player }: { player: TournamentPlayer | null | undefined }) {
  if (!player) {
    return (
      <div className="flex flex-col items-center gap-2 opacity-50">
        <div className="w-16 h-16 rounded-full bg-cream-200 flex items-center justify-center text-ink-500">—</div>
        <div className="text-sm text-ink-500">bye</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar
        username={player.username}
        profile={{
          username: player.username,
          avatarColor: player.avatarColor,
          avatarInitials: player.avatarInitials,
          avatarImage: player.avatarImage,
          equippedTitle: player.equippedTitle,
        }}
        size="lg"
      />
      <div className="text-sm font-medium">@{player.username}</div>
    </div>
  );
}

function CountdownView({ view, match, countdown, playerMap }: {
  view: TournamentView;
  match: TournamentMatch;
  countdown: number;
  playerMap: Map<string, TournamentPlayer>;
}) {
  const a = match.aId ? playerMap.get(match.aId) : null;
  const b = match.bId ? playerMap.get(match.bId) : null;
  return (
    <div className="flex flex-col items-center pt-6">
      <div className="text-clay uppercase text-[10px] tracking-[0.3em] mb-3 font-semibold">
        Game {view.currentGame} / Bo{view.bestOf}
      </div>
      <div className="text-[8rem] font-medium leading-none">{countdown}</div>
      <div className="flex items-center gap-6 mt-6 text-sm">
        <span>@{a?.username ?? "?"} <span className="tabular-nums text-clay">{match.winsA}</span></span>
        <span className="text-ink-500">vs</span>
        <span><span className="tabular-nums text-clay">{match.winsB}</span> @{b?.username ?? "?"}</span>
      </div>
    </div>
  );
}

function InGame({
  view, match, problem, gameStartedAt, yourSubmittedAt, youInMatch, playerMap, answer, setAnswer, submit,
}: {
  view: TournamentView;
  match: TournamentMatch;
  problem: NonNullable<ReturnType<typeof useTournament.getState>["problem"]>;
  gameStartedAt: number;
  yourSubmittedAt: number | null;
  youInMatch: boolean;
  playerMap: Map<string, TournamentPlayer>;
  answer: string;
  setAnswer: (s: string) => void;
  submit: (forced?: string) => void;
}) {
  const a = match.aId ? playerMap.get(match.aId) : null;
  const b = match.bId ? playerMap.get(match.bId) : null;
  return (
    <div className="flex flex-col items-center gap-7">
      <TimerRing totalSec={problem.timeLimitSec} startedAt={gameStartedAt} frozen={!!yourSubmittedAt} />
      <div className="card-raised p-6 w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-[0.25em] text-clay font-semibold">
            Round {match.round} · Game {view.currentGame}/Bo{view.bestOf} · {problem.tier}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-ink-500">
            @{a?.username ?? "?"} {match.winsA} – {match.winsB} @{b?.username ?? "?"}
          </div>
        </div>
        <MathBlock className="text-2xl leading-relaxed">{problem.prompt}</MathBlock>
      </div>

      {!youInMatch ? (
        <div className="card-quiet px-4 py-3 text-sm text-ink-700">
          <span className="chip chip-clay mr-2">Spectating</span>
          You're not in this match — watch the action.
        </div>
      ) : yourSubmittedAt ? (
        <div className="card-quiet px-4 py-3 text-sm text-ink-700">
          <span className="chip chip-good mr-2">Locked in</span>
          Waiting for opponent…
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
    </div>
  );
}

function GameEndedView({ lastGameEnded, match, playerMap, bestOf }: {
  lastGameEnded: NonNullable<ReturnType<typeof useTournament.getState>["lastGameEnded"]>;
  match: TournamentMatch;
  playerMap: Map<string, TournamentPlayer>;
  bestOf: number;
}) {
  const winner = lastGameEnded.gameWinnerId ? playerMap.get(lastGameEnded.gameWinnerId) : null;
  const a = match.aId ? playerMap.get(match.aId) : null;
  const b = match.bId ? playerMap.get(match.bId) : null;
  return (
    <div className="space-y-4">
      <div className="card p-5 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-ink-500 mb-1">
          Game {lastGameEnded.game} of Bo{bestOf}
        </div>
        {winner ? (
          <div className="text-lg">
            <span className="font-semibold text-good">@{winner.username}</span> takes the game
          </div>
        ) : (
          <div className="text-lg text-ink-700">No correct answer — replaying.</div>
        )}
        <div className="text-xs uppercase tracking-widest text-clay font-semibold mt-3 mb-1">Correct answer</div>
        <div className="text-xl mb-2"><MathBlock>{lastGameEnded.correctAnswer}</MathBlock></div>
        <div className="text-sm text-ink-700"><MathBlock>{lastGameEnded.solution}</MathBlock></div>
      </div>
      <div className="card p-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span>@{a?.username ?? "?"}</span>
          <span className="tabular-nums text-2xl font-medium text-clay">{lastGameEnded.winsA}</span>
        </div>
        <span className="text-ink-500">–</span>
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-2xl font-medium text-clay">{lastGameEnded.winsB}</span>
          <span>@{b?.username ?? "?"}</span>
        </div>
      </div>
    </div>
  );
}

function MatchOverView({ lastMatchOver, playerMap }: {
  lastMatchOver: NonNullable<ReturnType<typeof useTournament.getState>["lastMatchOver"]>;
  playerMap: Map<string, TournamentPlayer>;
}) {
  const winner = lastMatchOver.winnerId ? playerMap.get(lastMatchOver.winnerId) : null;
  return (
    <div className="card-raised p-8 text-center">
      <div className="text-[10px] uppercase tracking-[0.3em] text-good mb-2">Match decided</div>
      {winner ? (
        <>
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
          <div className="text-2xl font-medium">@{winner.username} advances</div>
        </>
      ) : (
        <div className="text-xl text-ink-700">No winner</div>
      )}
      <div className="text-sm text-ink-600 mt-2 tabular-nums">{lastMatchOver.winsA} – {lastMatchOver.winsB}</div>
      {lastMatchOver.reason === "forfeit" && (
        <div className="text-xs text-ink-500 mt-2">Opponent forfeited.</div>
      )}
    </div>
  );
}

function CompleteView({ championId, playerMap }: {
  championId: string | null;
  playerMap: Map<string, TournamentPlayer>;
}) {
  const champ = championId ? playerMap.get(championId) : null;
  return (
    <div className="card-raised p-10 text-center">
      <div className="text-[10px] uppercase tracking-[0.3em] text-good mb-3">Champion</div>
      {champ ? (
        <>
          <div className="flex justify-center mb-4">
            <Avatar
              username={champ.username}
              profile={{
                username: champ.username,
                avatarColor: champ.avatarColor,
                avatarInitials: champ.avatarInitials,
                avatarImage: champ.avatarImage,
                equippedTitle: champ.equippedTitle,
              }}
              size="xl"
              ring
            />
          </div>
          <div className="text-3xl font-medium">@{champ.username}</div>
          <div className="text-sm text-ink-600 mt-1">Bracket complete — well played.</div>
        </>
      ) : (
        <div className="text-xl text-ink-700">No champion crowned.</div>
      )}
    </div>
  );
}

function BracketView({ view, playerMap }: {
  view: TournamentView;
  playerMap: Map<string, TournamentPlayer>;
}) {
  const rounds: TournamentMatch[][] = [];
  for (const m of view.bracket) {
    rounds[m.round - 1] = rounds[m.round - 1] ?? [];
    rounds[m.round - 1].push(m);
  }
  for (const r of rounds) r.sort((x, y) => x.index - y.index);

  return (
    <section className="card p-4">
      <div className="text-xs uppercase tracking-widest text-clay font-semibold mb-3">Bracket</div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {rounds.map((round, i) => (
          <div key={i} className="flex flex-col gap-3 min-w-[140px]">
            <div className="text-[10px] uppercase tracking-widest text-ink-500 text-center">
              {i === rounds.length - 1 ? "Final" : i === rounds.length - 2 ? "Semi" : `R${i + 1}`}
            </div>
            {round.map((m) => (
              <BracketMatchTile key={m.id} match={m} playerMap={playerMap} isLive={m.id === view.currentMatchId} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function BracketMatchTile({ match, playerMap, isLive }: {
  match: TournamentMatch;
  playerMap: Map<string, TournamentPlayer>;
  isLive: boolean;
}) {
  const a = match.aId ? playerMap.get(match.aId) : null;
  const b = match.bId ? playerMap.get(match.bId) : null;
  return (
    <div className={`rounded-lg border text-xs overflow-hidden ${
      isLive ? "border-clay ring-1 ring-clay/30" : match.played ? "border-cream-200 opacity-80" : "border-cream-200"
    }`}>
      <BracketSlotRow
        label={match.aBye ? "bye" : a ? `@${a.username}` : "—"}
        wins={match.winsA}
        winner={match.played && match.winnerId === match.aId}
      />
      <div className="h-px bg-cream-200" />
      <BracketSlotRow
        label={match.bBye ? "bye" : b ? `@${b.username}` : "—"}
        wins={match.winsB}
        winner={match.played && match.winnerId === match.bId}
      />
    </div>
  );
}

function BracketSlotRow({ label, wins, winner }: { label: string; wins: number; winner: boolean }) {
  return (
    <div className={`flex items-center justify-between px-2 py-1.5 ${winner ? "bg-good/10 text-good font-semibold" : ""}`}>
      <span className="truncate">{label}</span>
      <span className="tabular-nums ml-2">{wins}</span>
    </div>
  );
}
