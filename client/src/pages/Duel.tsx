import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../store/game";
import { useAuth } from "../store/auth";
import { getSocket } from "../lib/socket";
import { Avatar } from "../components/Avatar";
import { TimerRing } from "../components/TimerRing";
import { MathBlock } from "../components/Math";
import { TitleChip } from "../components/TitleChip";
import { tierForElo } from "../lib/ranks";
import type { MatchOpponent } from "../lib/types";

export function Duel() {
  const phase = useGame((s) => s.phase);
  const match = useGame((s) => s.match);
  const countdown = useGame((s) => s.countdown);
  const question = useGame((s) => s.question);
  const questionStartedAt = useGame((s) => s.questionStartedAt);
  const opponentSubmitted = useGame((s) => s.opponentSubmitted);
  const yourSubmittedAt = useGame((s) => s.yourSubmittedAt);
  const score = useGame((s) => s.score);
  const round = useGame((s) => s.round);
  const roundsTotal = useGame((s) => s.roundsTotal);
  const roundResult = useGame((s) => s.roundResult);

  const user = useAuth((s) => s.user);
  const navigate = useNavigate();

  const [answer, setAnswer] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  useEffect(() => { setAnswer(""); }, [question?.questionId]);

  // If we land on /duel with no active match (e.g. page refresh after end),
  // bounce home instead of getting stuck on a "Waiting for match…" screen forever.
  useEffect(() => {
    if (!match && phase === "idle") navigate("/", { replace: true });
  }, [match, phase, navigate]);

  // Real abandonments: closing the tab or browser-navigating away. Tell the
  // server so the opponent gets the win instantly instead of waiting on a
  // disconnect grace timer.
  useEffect(() => {
    function onUnload() {
      const m = useGame.getState().match;
      const submitted = !!useGame.getState().yourSubmittedAt;
      if (m && !submitted) {
        try { getSocket().emit("match:forfeit"); } catch { /* socket already gone */ }
      }
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  function submit() {
    if (!match || !question || yourSubmittedAt || !answer.trim()) return;
    getSocket().emit("match:answer", { matchId: match.matchId, answer });
    useGame.getState().markYouSubmitted();
  }
  function submitChoice(opt: string) {
    if (!match || !question || yourSubmittedAt) return;
    getSocket().emit("match:answer", { matchId: match.matchId, answer: opt });
    useGame.getState().markYouSubmitted();
  }

  function reallyLeave() {
    // Already submitted? No forfeit — the round is effectively over for us.
    if (!yourSubmittedAt) {
      try { getSocket().emit("match:forfeit"); } catch { /* */ }
    }
    useGame.getState().reset();
    navigate("/", { replace: true });
  }

  if (!match || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-ink-500 gap-4">
        <div className="animate-pulse">Waiting for match…</div>
        <button className="btn-ghost text-sm" onClick={() => navigate("/", { replace: true })}>Back to home</button>
      </div>
    );
  }

  const opp = match.opponent;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top match strip — players + round indicator + running score */}
      <div className="px-6 py-5 border-b border-cream-200 bg-cream-100/30 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <PlayerCard
            username={user.username}
            elo={user.classicElo}
            equippedTitle={user.equippedTitle}
            side="you"
            submitted={!!yourSubmittedAt}
            score={score.you}
            self
          />
          <RoundBadge round={round} total={roundsTotal} phase={phase} countdown={countdown} />
          <PlayerCard
            username={opp.username}
            elo={opp.elo}
            equippedTitle={opp.equippedTitle}
            opponentProfile={opp}
            side="them"
            submitted={opponentSubmitted}
            score={score.opponent}
          />
        </div>
        {/* Leave control — explicit forfeit instead of freezing the game. */}
        <div className="max-w-4xl mx-auto mt-3 flex justify-end">
          {confirmLeave ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-bad">Forfeit — opponent wins the match?</span>
              <button className="btn-ghost text-xs px-3 py-1" onClick={() => setConfirmLeave(false)}>Cancel</button>
              <button className="btn-primary text-xs px-3 py-1" onClick={reallyLeave}>Confirm forfeit</button>
            </div>
          ) : (
            <button className="text-xs text-ink-500 hover:text-bad transition-colors" onClick={() => setConfirmLeave(true)}>
              Leave match
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 py-10">
        <AnimatePresence mode="wait">
          {phase === "match_found" && (
            <motion.div key="found" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center">
              <div className="text-clay uppercase text-xs tracking-[0.3em] mb-3 font-semibold">Match found · Best of {roundsTotal}</div>
              <div className="font-serif text-4xl">
                @{user.username} <span className="text-ink-500">vs</span> @{opp.username}
              </div>
              <div className="mt-4 text-ink-600 text-sm">Get ready…</div>
            </motion.div>
          )}

          {phase === "countdown" && countdown !== null && (
            <motion.div
              key={`cd-${round}-${countdown}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="flex flex-col items-center"
            >
              <div className="text-clay uppercase text-[10px] tracking-[0.3em] mb-3 font-semibold">Round {round} of {roundsTotal}</div>
              <div className="font-serif leading-none text-[14rem] text-shimmer">{countdown}</div>
            </motion.div>
          )}

          {phase === "in_duel" && question && questionStartedAt && (
            <motion.div key={`duel-${question.questionId}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl flex flex-col items-center gap-7">
              <TimerRing totalSec={question.timeLimitSec} startedAt={questionStartedAt} frozen={!!yourSubmittedAt} />
              <div className="card-raised p-7 w-full">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-clay font-bold">Round {question.round} · Problem</div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-ink-500 tabular-nums">
                    Score {score.you} – {score.opponent}
                  </div>
                </div>
                <MathBlock className="text-2xl leading-relaxed text-ink-950">{question.prompt}</MathBlock>
              </div>

              {yourSubmittedAt ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-quiet px-4 py-3 text-sm text-ink-700">
                  <span className="chip-good mr-2">Locked in</span>
                  {opponentSubmitted ? "Resolving round…" : "Waiting for opponent…"}
                </motion.div>
              ) : question.answerType === "multiple_choice" ? (
                <div className="grid grid-cols-2 gap-3 w-full">
                  {(question.options ?? []).map((opt) => (
                    <button key={opt} className="btn-ghost py-5 text-lg hover:border-clay/60 hover:bg-clay/10 transition-colors" onClick={() => submitChoice(opt)}>
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
                  <button className="btn-primary text-lg px-6" onClick={submit} disabled={!answer.trim()}>
                    Submit
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {phase === "round_over" && roundResult && (
            <motion.div
              key={`ro-${roundResult.round}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-md text-center"
            >
              <div className="text-[10px] uppercase tracking-[0.3em] text-ink-500 mb-2">Round {roundResult.round} of {roundResult.roundsTotal}</div>
              <div
                className={`font-serif text-6xl mb-3 ${
                  roundResult.result === "win" ? "text-good" : roundResult.result === "loss" ? "text-bad" : "text-ink-700"
                }`}
              >
                {roundResult.result === "win" ? "Round won" : roundResult.result === "loss" ? "Round lost" : "Round draw"}
              </div>
              <div className="card p-5 mb-3">
                <div className="text-[10px] uppercase tracking-widest text-clay font-semibold mb-1">Correct answer</div>
                <div className="text-xl"><MathBlock>{roundResult.correctAnswer}</MathBlock></div>
                <div className="grid grid-cols-2 gap-3 mt-4 text-left">
                  <RoundSide label="You" answer={roundResult.yourAnswer} correct={roundResult.youCorrect} timeMs={roundResult.yourTimeMs} />
                  <RoundSide label={`@${opp.username}`} answer={roundResult.opponentAnswer} correct={roundResult.opponentCorrect} timeMs={roundResult.opponentTimeMs} />
                </div>
              </div>
              <div className="text-sm text-ink-700 tabular-nums">
                Score <span className="font-semibold text-ink-950">{score.you} – {score.opponent}</span>
                {roundResult.round < roundResult.roundsTotal ? (
                  <span className="text-ink-500"> · next round in a moment</span>
                ) : (
                  <span className="text-ink-500"> · finalizing match…</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RoundBadge({ round, total, phase, countdown }: { round: number; total: number; phase: string; countdown: number | null }) {
  if (phase === "countdown" && countdown !== null) {
    return (
      <motion.div key={countdown} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-ink-500">Round {round}/{total}</div>
        <div className="text-3xl font-serif font-bold text-clay tabular-nums">{countdown}</div>
      </motion.div>
    );
  }
  return (
    <div className="flex flex-col items-center">
      <div className="text-[10px] uppercase tracking-[0.3em] text-ink-500">Round</div>
      <div className="text-xl font-serif font-bold tabular-nums">
        <span className="text-clay">{round}</span>
        <span className="text-ink-400">/{total}</span>
      </div>
    </div>
  );
}

function RoundSide({ label, answer, correct, timeMs }: { label: string; answer: string | null; correct: boolean; timeMs: number | null }) {
  return (
    <div className="card-quiet p-2">
      <div className="text-[10px] uppercase tracking-widest text-ink-500 mb-1">{label}</div>
      <div className={`text-sm ${correct ? "text-good" : "text-bad"}`}>{correct ? "Correct" : "Wrong"}</div>
      <div className="text-xs text-ink-700 break-all">{answer ?? <em className="text-ink-500">no answer</em>}</div>
      <div className="text-[11px] tabular-nums text-ink-600 mt-0.5">{timeMs == null ? "—" : `${(timeMs / 1000).toFixed(2)}s`}</div>
    </div>
  );
}

function PlayerCard({ username, elo, equippedTitle, side, submitted, score, self = false, opponentProfile }: {
  username: string;
  elo: number;
  equippedTitle: string;
  side: "you" | "them";
  submitted: boolean;
  score: number;
  self?: boolean;
  opponentProfile?: MatchOpponent;
}) {
  const tier = tierForElo(elo);
  const align = side === "them" ? "flex-row-reverse text-right" : "";
  return (
    <div className={`flex items-center gap-4 ${align}`}>
      <Avatar
        username={username}
        size="2xl"
        ring={self}
        self={self}
        profile={opponentProfile}
      />
      <div>
        <div className="font-semibold text-ink-950 text-base">@{username}</div>
        <div className={`mt-0.5 ${side === "them" ? "flex justify-end" : ""}`}>
          <TitleChip titleId={equippedTitle} size="xs" />
        </div>
        <div className="text-xs text-ink-600 mt-1">
          <span className="text-clay font-medium">{tier.name}</span>
          <span className="text-ink-500 mx-1.5">·</span>
          <span className="tabular-nums font-semibold text-ink-800">{elo}</span>
        </div>
        <div className={`mt-2 flex items-center gap-2 ${side === "them" ? "justify-end" : ""}`}>
          <span className={submitted ? "chip-good" : "chip-mute"}>
            {submitted ? "submitted" : "solving…"}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-ink-500 tabular-nums">
            {score} pt{score === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </div>
  );
}
