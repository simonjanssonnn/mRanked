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
  roundsTotal: number;
};

export type MatchQuestion = {
  questionId: string;
  prompt: string;
  answerType: "numeric" | "multiple_choice";
  options?: string[];
  timeLimitSec: number;
  calculatorAllowed: boolean;
  round: number;
  roundsTotal: number;
  yourScore: number;
  opponentScore: number;
};

export type RoundResult = {
  round: number;
  roundsTotal: number;
  yourScore: number;
  opponentScore: number;
  correctAnswer: string;
  yourAnswer: string | null;
  opponentAnswer: string | null;
  youCorrect: boolean;
  opponentCorrect: boolean;
  yourTimeMs: number | null;
  opponentTimeMs: number | null;
  result: "win" | "loss" | "draw";
  reason?: string;
};

export type RoundBreakdown = {
  problemPrompt: string;
  correctAnswer: string;
  yourAnswer: string | null;
  opponentAnswer: string | null;
  youCorrect: boolean;
  opponentCorrect: boolean;
  yourTimeMs: number | null;
  opponentTimeMs: number | null;
  result: "win" | "loss" | "draw";
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
  score: { you: number; opponent: number };
  rounds: RoundBreakdown[];
};

export type HistoryPlayer = PublicProfile & {
  id: string;
  classicElo: number;
};

export type LobbySettings = {
  rounds: number;
  timeLimitSec: number;
  tiers: string[];
  categories: string[];
};

export type LobbyPlayer = {
  userId: string;
  username: string;
  avatarColor: string;
  avatarInitials: string;
  avatarImage: string;
  equippedTitle: string;
  score: number;
  submitted: boolean;
  connected: boolean;
};

export type LobbyView = {
  code: string;
  hostId: string;
  settings: LobbySettings;
  state: "waiting" | "in_round" | "between_rounds" | "complete";
  round: number;
  rounds: number;
  players: LobbyPlayer[];
};

export type LobbyProblem = {
  id: string;
  prompt: string;
  answerType: "numeric" | "multiple_choice";
  options?: string[];
  timeLimitSec: number;
  calculatorAllowed: boolean;
  tier: string;
};

export type LobbyRoundEnded = {
  round: number;
  rounds: number;
  correctAnswer: string;
  solution: string;
  players: Array<{
    userId: string;
    username: string;
    answer: string | null;
    correct: boolean;
    timeMs: number | null;
    pointsThisRound: number;
    place: number | null;
    score: number;
  }>;
};

export type LobbyComplete = {
  rounds: number;
  final: Array<{
    userId: string;
    username: string;
    avatarColor: string;
    avatarInitials: string;
    avatarImage: string;
    equippedTitle: string;
    score: number;
  }>;
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
