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
  // Surfaced error from any lobby:error event so the UI can display it.
  roomError: { code: string; message?: string } | null;

  setView: (v: LobbyView | null) => void;
  setCountdown: (n: number | null) => void;
  setProblem: (p: LobbyProblem | null, startedAt: number | null) => void;
  markYouSubmitted: () => void;
  setRoundEnded: (r: LobbyRoundEnded | null) => void;
  setComplete: (c: LobbyComplete | null) => void;
  setJoinError: (msg: string | null) => void;
  setRoomError: (err: { code: string; message?: string } | null) => void;
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
  roomError: null,
};

export const useLobby = create<LobbyState>((set) => ({
  ...initial,
  setView: (view) =>
    set((s) => ({
      view,
      // A successful state broadcast after an error means the host fixed
      // settings or the lobby moved on — clear the stale error.
      roomError: view && view.state !== "waiting" ? null : s.roomError,
    })),
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
  setRoomError: (roomError) => set({ roomError }),
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
