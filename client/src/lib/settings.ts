// Local-only user settings. Persisted in localStorage. No server roundtrip.

export type Settings = {
  avatarColor: string;       // hex; derived from username if not set
  avatarInitials: string;    // up to 2 chars
  avatarImage: string;       // data URL of uploaded picture; if set, overrides color+initials
  reducedMotion: boolean;
  showAccuracyBar: boolean;
  preferredTier: string;     // for practice mode
  sound: boolean;            // beeps for countdown / match found
  language: "en" | "sv";
};

const KEY = "mr_settings_v1";

export const DEFAULT_SETTINGS: Settings = {
  avatarColor: "",
  avatarInitials: "",
  avatarImage: "",
  reducedMotion: false,
  showAccuracyBar: true,
  preferredTier: "auto",
  sound: false,
  language: "en",
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Partial<Settings>) {
  const current = loadSettings();
  const next = { ...current, ...s };
  window.localStorage.setItem(KEY, JSON.stringify(next));
  // Notify listeners (Avatar components etc.) so the UI updates instantly.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mr:settings"));
  }
  return next;
}

// A vibrant dark-mode palette: high-saturation hues that read clearly against deep navy.
const PALETTE = [
  "#2DD4BF", // teal
  "#38BDF8", // sky
  "#A78BFA", // violet
  "#F472B6", // pink
  "#FB923C", // orange
  "#FACC15", // amber
  "#34D399", // green
  "#F87171", // coral
  "#60A5FA", // blue
  "#C084FC", // purple
];

export function autoColor(username: string): string {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function autoInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

export const AVATAR_PALETTE = PALETTE;
