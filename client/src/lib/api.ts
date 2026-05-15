import type { HistoryResponse, PublicProfile, User } from "./types";

// All server endpoints live under /api/* so they never collide with client-side
// routes like /leaderboard or /profile (which used to return JSON on refresh).
const API_BASE = (import.meta.env.VITE_API_URL ?? "").trim();
const API = API_BASE ? `${API_BASE.replace(/\/$/, "")}/api` : "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "request_failed" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type LeaderboardEntry = PublicProfile & {
  id: string;
  classicElo: number;
  classicPeakElo: number;
  classicMatches: number;
  classicWins: number;
  classicLosses: number;
};

type PracticeProblem = {
  id: string;
  prompt: string;
  answerType: "numeric" | "multiple_choice";
  options: string[] | null;
  timeLimitSec: number;
  tier: string;
  difficultyElo: number;
};

type PracticeResult = {
  correct: boolean;
  accuracy: number;
  correctAnswer: string;
  solution: string;
};

export const api = {
  register: (body: { username: string; password: string }) =>
    request<{ user: User }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { username: string; password: string }) =>
    request<{ user: User }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/auth/me"),
  saveProfile: (body: Partial<Pick<User, "avatarColor" | "avatarInitials" | "avatarImage" | "equippedTitle">>) =>
    request<{ user: User }>("/me/profile", { method: "POST", body: JSON.stringify(body) }),
  history: () => request<HistoryResponse>("/me/history"),
  leaderboard: () => request<{ entries: LeaderboardEntry[] }>("/leaderboard"),
  practiceProblem: (elo: number) => request<{ problem: PracticeProblem }>(`/practice/problem?elo=${elo}`),
  practiceSubmit: (problemId: string, answer: string) =>
    request<PracticeResult>("/practice/submit", { method: "POST", body: JSON.stringify({ problemId, answer }) }),
};
