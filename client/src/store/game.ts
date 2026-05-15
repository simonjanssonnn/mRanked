import { create } from "zustand";
import type { MatchFound, MatchQuestion, MatchResult, RoundResult } from "../lib/types";

export type GamePhase =
  | "idle"
  | "queuing"
  | "match_found"
  | "countdown"
  | "in_duel"
  | "round_over"
  | "awaiting_result"
  | "result";

type GameState = {
  phase: GamePhase;
  searchRange: number;
  match: MatchFound | null;
  countdown: number | null;
  question: MatchQuestion | null;
  questionStartedAt: number | null;
  opponentSubmitted: boolean;
  yourSubmittedAt: number | null;
  result: MatchResult | null;
  roundResult: RoundResult | null;
  // Running score across the best-of-3, already from this player's perspective.
  score: { you: number; opponent: number };
  round: number;
  roundsTotal: number;

  setPhase: (p: GamePhase) => void;
  setSearchRange: (r: number) => void;
  setMatch: (m: MatchFound | null) => void;
  setCountdown: (n: number | null) => void;
  setQuestion: (q: MatchQuestion | null) => void;
  markOpponentSubmitted: () => void;
  markYouSubmitted: () => void;
  setResult: (r: MatchResult | null) => void;
  setRoundResult: (r: RoundResult | null) => void;
  reset: () => void;
};

const initial = {
  phase: "idle" as GamePhase,
  searchRange: 50,
  match: null,
  countdown: null,
  question: null,
  questionStartedAt: null,
  opponentSubmitted: false,
  yourSubmittedAt: null,
  result: null,
  roundResult: null,
  score: { you: 0, opponent: 0 },
  round: 1,
  roundsTotal: 3,
};

export const useGame = create<GameState>((set) => ({
  ...initial,
  setPhase: (phase) => set({ phase }),
  setSearchRange: (searchRange) => set({ searchRange }),
  setMatch: (match) => set({ match, roundsTotal: match?.roundsTotal ?? 3 }),
  setCountdown: (countdown) => set({ countdown }),
  setQuestion: (question) =>
    set({
      question,
      questionStartedAt: question ? Date.now() : null,
      opponentSubmitted: false,
      yourSubmittedAt: null,
      roundResult: null,
      round: question?.round ?? 1,
      roundsTotal: question?.roundsTotal ?? 3,
      score: question
        ? { you: question.yourScore, opponent: question.opponentScore }
        : initial.score,
    }),
  markOpponentSubmitted: () => set({ opponentSubmitted: true }),
  markYouSubmitted: () => set({ yourSubmittedAt: Date.now() }),
  setResult: (result) => set({ result }),
  setRoundResult: (r) =>
    set({
      roundResult: r,
      // Round just ended — clear the "submitted/solving" chips so the next
      // round's countdown screen doesn't show stale state.
      opponentSubmitted: false,
      yourSubmittedAt: null,
      score: r
        ? { you: r.yourScore, opponent: r.opponentScore }
        : initial.score,
    }),
  reset: () => set(initial),
}));
