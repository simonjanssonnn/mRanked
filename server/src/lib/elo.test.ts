import { describe, expect, it } from "vitest";
import {
  applyDelta,
  computeDeltas,
  ELO_CONFIG,
  expectedScore,
  kFactor,
  resolveOutcome,
  type PlayerSubmission,
} from "./elo.js";

// Helper — keep test cases short and readable.
const sub = (over: Partial<PlayerSubmission> = {}): PlayerSubmission => ({
  submitted: true,
  correct: true,
  accuracy: 1,
  timeMs: 5000,
  ...over,
});

describe("expectedScore", () => {
  it("returns 0.5 when ratings are equal", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 6);
  });
  it("favours the higher-rated player", () => {
    expect(expectedScore(1900, 1500)).toBeGreaterThan(0.5);
    expect(expectedScore(1500, 1900)).toBeLessThan(0.5);
  });
  it("matches the textbook 400-gap value (~0.909)", () => {
    expect(expectedScore(1900, 1500)).toBeCloseTo(0.909, 2);
  });
  it("symmetric around 0.5", () => {
    const a = expectedScore(1700, 1500);
    const b = expectedScore(1500, 1700);
    expect(a + b).toBeCloseTo(1, 6);
  });
});

describe("kFactor", () => {
  it("uses provisional K below the match threshold", () => {
    expect(kFactor(0)).toBe(ELO_CONFIG.PROVISIONAL_K);
    expect(kFactor(ELO_CONFIG.PROVISIONAL_MATCH_THRESHOLD - 1)).toBe(ELO_CONFIG.PROVISIONAL_K);
  });
  it("uses base K once provisional period is over", () => {
    expect(kFactor(ELO_CONFIG.PROVISIONAL_MATCH_THRESHOLD)).toBe(ELO_CONFIG.BASE_K);
    expect(kFactor(500)).toBe(ELO_CONFIG.BASE_K);
  });
});

describe("applyDelta", () => {
  it("adds a positive delta", () => {
    expect(applyDelta(1500, 24)).toBe(1524);
  });
  it("subtracts a negative delta", () => {
    expect(applyDelta(1500, -24)).toBe(1476);
  });
  it("clamps to the ELO floor (won't go below 0)", () => {
    expect(applyDelta(10, -50)).toBe(ELO_CONFIG.ELO_FLOOR);
  });
  it("ELO floor is exactly 0 in current config", () => {
    expect(ELO_CONFIG.ELO_FLOOR).toBe(0);
  });
});

describe("resolveOutcome — submission presence", () => {
  it("neither submitted → mutual draw", () => {
    const o = resolveOutcome(sub({ submitted: false, timeMs: Infinity }), sub({ submitted: false, timeMs: Infinity }));
    expect(o.aBase).toBe(0.5);
    expect(o.bBase).toBe(0.5);
    expect(o.bothWrong).toBe(true);
    expect(o.reason).toBe("neither_submitted");
  });
  it("only A failed to submit → B wins outright", () => {
    const o = resolveOutcome(
      sub({ submitted: false, timeMs: Infinity }),
      sub({ correct: true }),
    );
    expect(o.aBase).toBe(0);
    expect(o.bBase).toBe(1);
    expect(o.bothWrong).toBe(false);
  });
  it("only B failed to submit → A wins outright", () => {
    const o = resolveOutcome(
      sub({ correct: true }),
      sub({ submitted: false, timeMs: Infinity }),
    );
    expect(o.aBase).toBe(1);
    expect(o.bBase).toBe(0);
  });
});

describe("resolveOutcome — both correct (speed tiebreak)", () => {
  it("faster player wins when both correct", () => {
    const o = resolveOutcome(sub({ timeMs: 3000 }), sub({ timeMs: 5000 }));
    expect(o.aBase).toBe(1);
    expect(o.bBase).toBe(0);
    expect(o.reason).toBe("a_faster_correct");
  });
  it("symmetric when B is faster", () => {
    const o = resolveOutcome(sub({ timeMs: 5000 }), sub({ timeMs: 3000 }));
    expect(o.aBase).toBe(0);
    expect(o.bBase).toBe(1);
    expect(o.reason).toBe("b_faster_correct");
  });
  it("identical times (within DRAW_WINDOW_MS=0) → draw", () => {
    const o = resolveOutcome(sub({ timeMs: 4000 }), sub({ timeMs: 4000 }));
    expect(o.aBase).toBe(0.5);
    expect(o.bBase).toBe(0.5);
    expect(o.bothWrong).toBe(false);
    expect(o.reason).toBe("draw_speed");
  });
});

describe("resolveOutcome — one correct", () => {
  it("A correct, B wrong → A wins", () => {
    const o = resolveOutcome(
      sub({ correct: true, accuracy: 1 }),
      sub({ correct: false, accuracy: 0.4 }),
    );
    expect(o.aBase).toBe(1);
    expect(o.bBase).toBe(0);
    expect(o.bothWrong).toBe(false);
    expect(o.reason).toBe("a_correct");
  });
  it("B correct, A wrong → B wins", () => {
    const o = resolveOutcome(
      sub({ correct: false, accuracy: 0.3 }),
      sub({ correct: true, accuracy: 1 }),
    );
    expect(o.aBase).toBe(0);
    expect(o.bBase).toBe(1);
    expect(o.reason).toBe("b_correct");
  });
});

describe("resolveOutcome — both wrong", () => {
  it("A more accurate → A wins, bothWrong flagged", () => {
    const o = resolveOutcome(
      sub({ correct: false, accuracy: 0.8, timeMs: 6000 }),
      sub({ correct: false, accuracy: 0.3, timeMs: 4000 }),
    );
    expect(o.aBase).toBe(1);
    expect(o.bBase).toBe(0);
    expect(o.bothWrong).toBe(true);
    expect(o.reason).toBe("a_closer_wrong");
  });
  it("B more accurate → B wins, bothWrong flagged", () => {
    const o = resolveOutcome(
      sub({ correct: false, accuracy: 0.2 }),
      sub({ correct: false, accuracy: 0.7 }),
    );
    expect(o.bBase).toBe(1);
    expect(o.aBase).toBe(0);
    expect(o.bothWrong).toBe(true);
  });
  it("accuracy tied within epsilon, A faster → A wins", () => {
    const o = resolveOutcome(
      sub({ correct: false, accuracy: 0.5, timeMs: 2000 }),
      sub({ correct: false, accuracy: 0.5, timeMs: 4000 }),
    );
    expect(o.aBase).toBe(1);
    expect(o.bBase).toBe(0);
    expect(o.bothWrong).toBe(true);
    expect(o.reason).toBe("a_faster_wrong");
  });
  it("accuracy tied within epsilon, B faster → B wins", () => {
    const o = resolveOutcome(
      sub({ correct: false, accuracy: 0.5, timeMs: 4000 }),
      sub({ correct: false, accuracy: 0.5, timeMs: 2000 }),
    );
    expect(o.bBase).toBe(1);
    expect(o.aBase).toBe(0);
  });
  it("accuracy tied and times identical → mutual draw", () => {
    const o = resolveOutcome(
      sub({ correct: false, accuracy: 0.5, timeMs: 4000 }),
      sub({ correct: false, accuracy: 0.5, timeMs: 4000 }),
    );
    expect(o.aBase).toBe(0.5);
    expect(o.bBase).toBe(0.5);
    expect(o.bothWrong).toBe(true);
  });
});

describe("computeDeltas", () => {
  const basics = {
    matchesA: 50,
    matchesB: 50,
    accuracyA: 1,
    accuracyB: 0,
  };

  it("winner gains, loser loses by symmetric magnitudes (equal ratings)", () => {
    const { dA, dB } = computeDeltas({
      ...basics, rA: 1500, rB: 1500,
      outcome: { aBase: 1, bBase: 0, bothWrong: false, reason: "a" },
    });
    expect(dA).toBeGreaterThan(0);
    expect(dB).toBeLessThan(0);
    // Equal ratings + symmetric accuracy => deltas cancel out exactly.
    expect(dA + dB).toBe(0);
  });

  it("upset (lower rated beats higher rated) yields a bigger delta", () => {
    const upset = computeDeltas({
      ...basics, rA: 1500, rB: 1900,
      outcome: { aBase: 1, bBase: 0, bothWrong: false, reason: "a" },
    });
    const expected = computeDeltas({
      ...basics, rA: 1900, rB: 1500,
      outcome: { aBase: 1, bBase: 0, bothWrong: false, reason: "a" },
    });
    expect(upset.dA).toBeGreaterThan(expected.dA);
  });

  it("draws produce small mirrored deltas centred on 0 for equal ratings", () => {
    const { dA, dB } = computeDeltas({
      ...basics, rA: 1500, rB: 1500, accuracyA: 0.5, accuracyB: 0.5,
      outcome: { aBase: 0.5, bBase: 0.5, bothWrong: false, reason: "draw" },
    });
    expect(dA).toBe(0);
    expect(dB).toBe(0);
  });

  it("bothWrong applies the 0.5x K multiplier", () => {
    const correct = computeDeltas({
      ...basics, rA: 1500, rB: 1500, accuracyA: 1, accuracyB: 0,
      outcome: { aBase: 1, bBase: 0, bothWrong: false, reason: "a" },
    });
    const sloppy = computeDeltas({
      ...basics, rA: 1500, rB: 1500, accuracyA: 1, accuracyB: 0,
      outcome: { aBase: 1, bBase: 0, bothWrong: true, reason: "a" },
    });
    expect(Math.abs(sloppy.dA)).toBeLessThan(Math.abs(correct.dA));
  });

  it("respects MAX_SWING cap on huge upsets", () => {
    const { dA, dB } = computeDeltas({
      rA: 800, rB: 2600, matchesA: 0, matchesB: 100,
      accuracyA: 1, accuracyB: 0,
      outcome: { aBase: 1, bBase: 0, bothWrong: false, reason: "a" },
    });
    expect(dA).toBeLessThanOrEqual(ELO_CONFIG.MAX_SWING);
    expect(dB).toBeGreaterThanOrEqual(-ELO_CONFIG.MAX_SWING);
  });

  it("provisional players swing harder", () => {
    const prov = computeDeltas({
      rA: 1500, rB: 1500, matchesA: 0, matchesB: 50,
      accuracyA: 1, accuracyB: 0,
      outcome: { aBase: 1, bBase: 0, bothWrong: false, reason: "a" },
    });
    const seasoned = computeDeltas({
      rA: 1500, rB: 1500, matchesA: 50, matchesB: 50,
      accuracyA: 1, accuracyB: 0,
      outcome: { aBase: 1, bBase: 0, bothWrong: false, reason: "a" },
    });
    expect(prov.dA).toBeGreaterThan(seasoned.dA);
  });

  it("high accuracy boosts the winner's delta", () => {
    const accurate = computeDeltas({
      ...basics, rA: 1500, rB: 1500, accuracyA: 1, accuracyB: 0,
      outcome: { aBase: 1, bBase: 0, bothWrong: false, reason: "a" },
    });
    const meh = computeDeltas({
      ...basics, rA: 1500, rB: 1500, accuracyA: 0.5, accuracyB: 0.5,
      outcome: { aBase: 1, bBase: 0, bothWrong: false, reason: "a" },
    });
    expect(accurate.dA).toBeGreaterThan(meh.dA);
  });

  it("low accuracy penalises further on a loss", () => {
    const careful = computeDeltas({
      ...basics, rA: 1500, rB: 1500, accuracyA: 0.5, accuracyB: 0.5,
      outcome: { aBase: 0, bBase: 1, bothWrong: false, reason: "b" },
    });
    const sloppy = computeDeltas({
      ...basics, rA: 1500, rB: 1500, accuracyA: 0, accuracyB: 1,
      outcome: { aBase: 0, bBase: 1, bothWrong: false, reason: "b" },
    });
    expect(sloppy.dA).toBeLessThan(careful.dA);
  });

  it("deltas are integers (Math.round'd)", () => {
    const { dA, dB } = computeDeltas({
      ...basics, rA: 1473, rB: 1591,
      outcome: { aBase: 1, bBase: 0, bothWrong: false, reason: "a" },
    });
    expect(Number.isInteger(dA)).toBe(true);
    expect(Number.isInteger(dB)).toBe(true);
  });
});
