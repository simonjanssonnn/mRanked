import { create } from "zustand";
import type { User } from "../lib/types";
import { api } from "../lib/api";

type AuthState = {
  user: User | null;
  loading: boolean;
  init: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  init: async () => {
    try {
      const { user } = await api.me();
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  login: async (username, password) => {
    const { user } = await api.login({ username, password });
    set({ user });
  },
  register: async (username, password) => {
    const { user } = await api.register({ username, password });
    set({ user });
  },
  logout: async () => {
    // Best-effort: even if the server call fails (network, etc), clear local state
    // so the user actually sees the login screen.
    try {
      await api.logout();
    } catch (e) {
      console.warn("Logout request failed; clearing client state anyway.", e);
    }
    set({ user: null });
  },
  setUser: (user) => set({ user }),
}));
