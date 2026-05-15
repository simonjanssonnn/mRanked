import { create } from "zustand";
import type { MatchFound, MatchQuestion, MatchResult } from "../lib/types";

export type GamePhase =
  | "idle"
  | "queuing"
  | "match_found"
  | "countdown"
  | "in_duel"
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

  setPhase: (p: GamePhase) => void;
  setSearchRange: (r: number) => void;
  setMatch: (m: MatchFound | null) => void;
  setCountdown: (n: number | null) => void;
  setQuestion: (q: MatchQuestion | null) => void;
  markOpponentSubmitted: () => void;
  markYouSubmitted: () => void;
  setResult: (r: MatchResult | null) => void;
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
};

export const useGame = create<GameState>((set) => ({
  ...initial,
  setPhase: (phase) => set({ phase }),
  setSearchRange: (searchRange) => set({ searchRange }),
  setMatch: (match) => set({ match }),
  setCountdown: (countdown) => set({ countdown }),
  setQuestion: (question) => set({ question, questionStartedAt: question ? Date.now() : null }),
  markOpponentSubmitted: () => set({ opponentSubmitted: true }),
  markYouSubmitted: () => set({ yourSubmittedAt: Date.now() }),
  setResult: (result) => set({ result }),
  reset: () => set(initial),
}));
