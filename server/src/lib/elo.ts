// ELO + scoring per §5 of the build spec.
// Pure functions — no IO. Easy to unit-test.

export const ELO_CONFIG = {
  STARTING_ELO: 1000,
  BASE_K: 48,
  PROVISIONAL_K: 80,
  PROVISIONAL_MATCH_THRESHOLD: 10,
  BOTH_WRONG_K_MULT: 0.5,
  ACC_MOD_SCALE: 16,
  ACC_MOD_MAX: 8,
  MAX_SWING: 36,
  DRAW_WINDOW_MS: 0, // strict tiebreak — fastest correct answer wins
  DRAW_ACCURACY_EPSILON: 0.05,
  ELO_FLOOR: 0,
};

export type PlayerSubmission = {
  submitted: boolean;
  correct: boolean;       // strict correctness (within tolerance for numeric)
  accuracy: number;       // 0..1
  timeMs: number;         // ms from problem-shown to submit; Infinity if never submitted
};

export type RoundOutcome = {
  aBase: number;     // 1 | 0.5 | 0
  bBase: number;
  bothWrong: boolean;
  reason: string;
};

export function resolveOutcome(a: PlayerSubmission, b: PlayerSubmission): RoundOutcome {
  // Neither submitted -> draw
  if (!a.submitted && !b.submitted) {
    return { aBase: 0.5, bBase: 0.5, bothWrong: true, reason: "neither_submitted" };
  }
  // One didn't submit -> the submitter wins outright (caller may apply disconnect modifier separately)
  if (!a.submitted) return { aBase: 0, bBase: 1, bothWrong: false, reason: "a_no_submit" };
  if (!b.submitted) return { aBase: 1, bBase: 0, bothWrong: false, reason: "b_no_submit" };

  if (a.correct && b.correct) {
    const diff = a.timeMs - b.timeMs;
    if (Math.abs(diff) <= ELO_CONFIG.DRAW_WINDOW_MS) {
      return { aBase: 0.5, bBase: 0.5, bothWrong: false, reason: "draw_speed" };
    }
    return diff < 0
      ? { aBase: 1, bBase: 0, bothWrong: false, reason: "a_faster_correct" }
      : { aBase: 0, bBase: 1, bothWrong: false, reason: "b_faster_correct" };
  }

  if (a.correct && !b.correct) return { aBase: 1, bBase: 0, bothWrong: false, reason: "a_correct" };
  if (!a.correct && b.correct) return { aBase: 0, bBase: 1, bothWrong: false, reason: "b_correct" };

  // Both wrong -> closer accuracy wins (reduced K applied later).
  // If accuracy is essentially tied, fall back to speed so we never produce a
  // draw when both players actually submitted — matches the "fastest wins"
  // promise we make to players.
  const accDiff = a.accuracy - b.accuracy;
  if (Math.abs(accDiff) <= ELO_CONFIG.DRAW_ACCURACY_EPSILON) {
    if (a.timeMs === b.timeMs) {
      return { aBase: 0.5, bBase: 0.5, bothWrong: true, reason: "both_wrong_tie" };
    }
    return a.timeMs < b.timeMs
      ? { aBase: 1, bBase: 0, bothWrong: true, reason: "a_faster_wrong" }
      : { aBase: 0, bBase: 1, bothWrong: true, reason: "b_faster_wrong" };
  }
  return accDiff > 0
    ? { aBase: 1, bBase: 0, bothWrong: true, reason: "a_closer_wrong" }
    : { aBase: 0, bBase: 1, bothWrong: true, reason: "b_closer_wrong" };
}

export function expectedScore(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

export function kFactor(matchesPlayed: number): number {
  return matchesPlayed < ELO_CONFIG.PROVISIONAL_MATCH_THRESHOLD
    ? ELO_CONFIG.PROVISIONAL_K
    : ELO_CONFIG.BASE_K;
}

export type DeltaInput = {
  rA: number;
  rB: number;
  matchesA: number;
  matchesB: number;
  outcome: RoundOutcome;
  accuracyA: number;
  accuracyB: number;
};

export function computeDeltas(input: DeltaInput): { dA: number; dB: number } {
  const { rA, rB, matchesA, matchesB, outcome, accuracyA, accuracyB } = input;
  const eA = expectedScore(rA, rB);
  const eB = 1 - eA;

  const kA = kFactor(matchesA);
  const kB = kFactor(matchesB);
  const mult = outcome.bothWrong ? ELO_CONFIG.BOTH_WRONG_K_MULT : 1;

  const baseA = kA * mult * (outcome.aBase - eA);
  const baseB = kB * mult * (outcome.bBase - eB);

  const modA = clamp(
    ELO_CONFIG.ACC_MOD_SCALE * (accuracyA - 0.5),
    -ELO_CONFIG.ACC_MOD_MAX,
    ELO_CONFIG.ACC_MOD_MAX
  );
  const modB = clamp(
    ELO_CONFIG.ACC_MOD_SCALE * (accuracyB - 0.5),
    -ELO_CONFIG.ACC_MOD_MAX,
    ELO_CONFIG.ACC_MOD_MAX
  );

  const dA = Math.round(clamp(baseA + modA, -ELO_CONFIG.MAX_SWING, ELO_CONFIG.MAX_SWING));
  const dB = Math.round(clamp(baseB + modB, -ELO_CONFIG.MAX_SWING, ELO_CONFIG.MAX_SWING));
  return { dA, dB };
}

export function applyDelta(currentElo: number, delta: number): number {
  return Math.max(ELO_CONFIG.ELO_FLOOR, currentElo + delta);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
