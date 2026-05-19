import { create } from "zustand";
import type {
  TournamentComplete,
  TournamentGameEnded,
  TournamentMatchOver,
  TournamentProblem,
  TournamentView,
} from "../lib/types";

type TournamentState = {
  view: TournamentView | null;
  countdown: number | null;
  problem: TournamentProblem | null;
  gameStartedAt: number | null;
  yourSubmittedAt: number | null;
  lastGameEnded: TournamentGameEnded | null;
  lastMatchOver: TournamentMatchOver | null;
  complete: TournamentComplete | null;
  joinError: string | null;
  roomError: { code: string; message?: string } | null;

  setView: (v: TournamentView | null) => void;
  setCountdown: (n: number | null) => void;
  setProblem: (p: TournamentProblem | null, startedAt: number | null) => void;
  markYouSubmitted: () => void;
  setGameEnded: (e: TournamentGameEnded | null) => void;
  setMatchOver: (m: TournamentMatchOver | null) => void;
  setComplete: (c: TournamentComplete | null) => void;
  setJoinError: (msg: string | null) => void;
  setRoomError: (err: { code: string; message?: string } | null) => void;
  prepGame: () => void;
  resetRoom: () => void;
};

const initial = {
  view: null,
  countdown: null,
  problem: null,
  gameStartedAt: null,
  yourSubmittedAt: null,
  lastGameEnded: null,
  lastMatchOver: null,
  complete: null,
  joinError: null,
  roomError: null,
};

export const useTournament = create<TournamentState>((set) => ({
  ...initial,
  setView: (view) =>
    set((s) => ({
      view,
      roomError: view && view.state !== "waiting" ? null : s.roomError,
    })),
  setCountdown: (countdown) => set({ countdown }),
  setProblem: (problem, gameStartedAt) =>
    set({
      problem,
      gameStartedAt,
      yourSubmittedAt: null,
      lastGameEnded: null,
      countdown: null,
    }),
  markYouSubmitted: () => set({ yourSubmittedAt: Date.now() }),
  setGameEnded: (lastGameEnded) => set({ lastGameEnded, yourSubmittedAt: null }),
  setMatchOver: (lastMatchOver) => set({ lastMatchOver }),
  setComplete: (complete) => set({ complete }),
  setJoinError: (joinError) => set({ joinError }),
  setRoomError: (roomError) => set({ roomError }),
  prepGame: () =>
    set({
      problem: null,
      gameStartedAt: null,
      yourSubmittedAt: null,
      lastGameEnded: null,
      countdown: null,
    }),
  resetRoom: () => set(initial),
}));
