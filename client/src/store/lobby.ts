import { create } from "zustand";
import type {
  LobbyComplete,
  LobbyProblem,
  LobbyRoundEnded,
  LobbyView,
} from "../lib/types";

type LobbyState = {
  view: LobbyView | null;
  countdown: number | null;
  problem: LobbyProblem | null;
  roundStartedAt: number | null;
  yourSubmittedAt: number | null;
  roundEnded: LobbyRoundEnded | null;
  complete: LobbyComplete | null;
  joinError: string | null;

  setView: (v: LobbyView | null) => void;
  setCountdown: (n: number | null) => void;
  setProblem: (p: LobbyProblem | null, startedAt: number | null) => void;
  markYouSubmitted: () => void;
  setRoundEnded: (r: LobbyRoundEnded | null) => void;
  setComplete: (c: LobbyComplete | null) => void;
  setJoinError: (msg: string | null) => void;
  // Called when a new round is about to begin — clears the prior round's
  // problem/roundStartedAt so the countdown screen renders cleanly.
  prepRound: () => void;
  resetRoom: () => void;
};

const initial = {
  view: null,
  countdown: null,
  problem: null,
  roundStartedAt: null,
  yourSubmittedAt: null,
  roundEnded: null,
  complete: null,
  joinError: null,
};

export const useLobby = create<LobbyState>((set) => ({
  ...initial,
  setView: (view) => set({ view }),
  setCountdown: (countdown) => set({ countdown }),
  setProblem: (problem, roundStartedAt) =>
    set({
      problem,
      roundStartedAt,
      yourSubmittedAt: null,
      roundEnded: null,
      countdown: null,
    }),
  markYouSubmitted: () => set({ yourSubmittedAt: Date.now() }),
  setRoundEnded: (roundEnded) => set({ roundEnded, yourSubmittedAt: null }),
  setComplete: (complete) => set({ complete }),
  setJoinError: (joinError) => set({ joinError }),
  prepRound: () =>
    set({
      problem: null,
      roundStartedAt: null,
      yourSubmittedAt: null,
      roundEnded: null,
      countdown: null,
    }),
  resetRoom: () => set(initial),
}));
