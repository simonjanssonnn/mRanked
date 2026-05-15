export type PublicProfile = {
  username: string;
  avatarColor: string;
  avatarInitials: string;
  avatarImage: string;
  equippedTitle: string;
};

export type User = PublicProfile & {
  id: string;
  classicElo: number;
  classicPeakElo: number;
  classicMatches: number;
  classicWins: number;
  classicLosses: number;
  classicDraws: number;
  createdAt: string;
};

export type MatchOpponent = PublicProfile & {
  elo: number;
  rank: string;
};

export type MatchFound = {
  matchId: string;
  opponent: MatchOpponent;
  mode: string;
};

export type MatchQuestion = {
  questionId: string;
  prompt: string;
  answerType: "numeric" | "multiple_choice";
  options?: string[];
  timeLimitSec: number;
  calculatorAllowed: boolean;
};

export type MatchResult = {
  youCorrect: boolean;
  opponentCorrect: boolean;
  yourAccuracy: number;
  opponentAccuracy: number;
  yourTimeMs: number | null;
  opponentTimeMs: number | null;
  eloDelta: number;
  newElo: number;
  oldRank: string;
  newRank: string;
  rankChanged: boolean;
  rankDirection: "promotion" | "demotion" | null;
  correctAnswer: string;
  acceptableForms: string[];
  solution: string;
  yourAnswer: string | null;
  opponentAnswer: string | null;
  result: "win" | "loss" | "draw";
  reason?: string;
  opponent?: MatchOpponent;
};

export type HistoryPlayer = PublicProfile & {
  id: string;
  classicElo: number;
};

export type HistoryResponse = {
  matches: Array<{
    id: string;
    mode: string;
    endedAt: string | null;
    problem: { prompt: string; correctAnswer: string; tier: string; category: string } | null;
    you: HistoryPlayer & { accuracy: number | null; timeMs: number | null; eloDelta: number | null; answer: string | null };
    opponent: HistoryPlayer & { accuracy: number | null; timeMs: number | null; answer: string | null };
    result: "win" | "loss" | "draw";
  }>;
  eloHistory: Array<{ at: string; elo: number }>;
};
