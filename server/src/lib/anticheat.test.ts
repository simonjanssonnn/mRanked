import { describe, expect, it } from "vitest";
import { isImpossiblyFast, minSolveMs } from "./anticheat.js";

describe("minSolveMs — per-tier floors", () => {
  it("Initiate 200ms", () => {
    expect(minSolveMs("Initiate")).toBe(200);
  });
  it("Bronze 350ms", () => {
    expect(minSolveMs("Bronze")).toBe(350);
  });
  it("Silver 500ms", () => {
    expect(minSolveMs("Silver")).toBe(500);
  });
  it("Gold 800ms", () => {
    expect(minSolveMs("Gold")).toBe(800);
  });
  it("Platinum 1200ms", () => {
    expect(minSolveMs("Platinum")).toBe(1200);
  });
  it("Diamond 1800ms", () => {
    expect(minSolveMs("Diamond")).toBe(1800);
  });
  it("Master 2500ms", () => {
    expect(minSolveMs("Master")).toBe(2500);
  });
  it("Grandmaster 3200ms", () => {
    expect(minSolveMs("Grandmaster")).toBe(3200);
  });
  it("unknown tier falls back to a default (>= 200ms)", () => {
    expect(minSolveMs("Galactic Overlord")).toBeGreaterThanOrEqual(200);
  });
  it("floors increase with difficulty", () => {
    const tiers = ["Initiate", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Grandmaster"];
    for (let i = 1; i < tiers.length; i++) {
      expect(minSolveMs(tiers[i])).toBeGreaterThan(minSolveMs(tiers[i - 1]));
    }
  });
});

describe("isImpossiblyFast", () => {
  it("zero ms is always flagged", () => {
    expect(isImpossiblyFast("Initiate", 0)).toBe(true);
    expect(isImpossiblyFast("Grandmaster", 0)).toBe(true);
  });
  it("below the floor → flagged", () => {
    expect(isImpossiblyFast("Initiate", 199)).toBe(true);
    expect(isImpossiblyFast("Gold", 799)).toBe(true);
    expect(isImpossiblyFast("Grandmaster", 3199)).toBe(true);
  });
  it("exactly at the floor → not flagged (strict <)", () => {
    expect(isImpossiblyFast("Initiate", 200)).toBe(false);
    expect(isImpossiblyFast("Gold", 800)).toBe(false);
    expect(isImpossiblyFast("Grandmaster", 3200)).toBe(false);
  });
  it("well above the floor → not flagged", () => {
    expect(isImpossiblyFast("Initiate", 5000)).toBe(false);
    expect(isImpossiblyFast("Gold", 10_000)).toBe(false);
  });
  it("Infinity (no submission) → not flagged", () => {
    expect(isImpossiblyFast("Initiate", Infinity)).toBe(false);
  });
  it("NaN → not flagged (Number.isFinite gate)", () => {
    expect(isImpossiblyFast("Initiate", NaN)).toBe(false);
  });
  it("a typical human reaction time (~300ms) is fine for Initiate but flagged for Silver+", () => {
    expect(isImpossiblyFast("Initiate", 300)).toBe(false);
    expect(isImpossiblyFast("Silver", 300)).toBe(true);
  });
  it("unknown tier uses the default floor", () => {
    // Default is 200ms; 199 below, 200 at, 300 above.
    expect(isImpossiblyFast("???", 199)).toBe(true);
    expect(isImpossiblyFast("???", 300)).toBe(false);
  });
});
