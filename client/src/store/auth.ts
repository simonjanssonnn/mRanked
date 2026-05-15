import { create } from "zustand";
import type { User } from "../lib/types";
import { api } from "../lib/api";
import { loadSettings, saveSettings } from "../lib/settings";

// When the server returns the user, copy any avatar fields the user has on the
// server into localStorage if local is empty. This is what makes uploaded
// pictures show up on a new browser / private tab without needing a re-upload.
function hydrateAvatarFromServer(user: User) {
  const local = loadSettings();
  const patch: Partial<typeof local> = {};
  if (!local.avatarImage && user.avatarImage) patch.avatarImage = user.avatarImage;
  if (!local.avatarColor && user.avatarColor) patch.avatarColor = user.avatarColor;
  if (!local.avatarInitials && user.avatarInitials) patch.avatarInitials = user.avatarInitials;
  if (Object.keys(patch).length > 0) saveSettings(patch);
}

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
      hydrateAvatarFromServer(user);
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  login: async (username, password) => {
    const { user } = await api.login({ username, password });
    hydrateAvatarFromServer(user);
    set({ user });
  },
  register: async (username, password) => {
    const { user } = await api.register({ username, password });
    hydrateAvatarFromServer(user);
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
