import { describe, expect, it } from "vitest";
import { CLASSIC_TIERS, rankChange, tierForElo } from "./ranks.js";

describe("tierForElo — boundary correctness", () => {
  it("0 ELO → Initiate", () => {
    expect(tierForElo(0).name).toBe("Initiate");
  });
  it("799 (last Initiate point) → Initiate", () => {
    expect(tierForElo(799).name).toBe("Initiate");
  });
  it("800 (first Bronze point) → Bronze", () => {
    expect(tierForElo(800).name).toBe("Bronze");
  });
  it("1099 → Bronze", () => {
    expect(tierForElo(1099).name).toBe("Bronze");
  });
  it("1100 → Silver", () => {
    expect(tierForElo(1100).name).toBe("Silver");
  });
  it("1399 → Silver", () => {
    expect(tierForElo(1399).name).toBe("Silver");
  });
  it("1400 → Gold", () => {
    expect(tierForElo(1400).name).toBe("Gold");
  });
  it("1699 → Gold, 1700 → Platinum", () => {
    expect(tierForElo(1699).name).toBe("Gold");
    expect(tierForElo(1700).name).toBe("Platinum");
  });
  it("1999 → Platinum, 2000 → Diamond", () => {
    expect(tierForElo(1999).name).toBe("Platinum");
    expect(tierForElo(2000).name).toBe("Diamond");
  });
  it("2299 → Diamond, 2300 → Master", () => {
    expect(tierForElo(2299).name).toBe("Diamond");
    expect(tierForElo(2300).name).toBe("Master");
  });
  it("2599 → Master, 2600 → Grandmaster", () => {
    expect(tierForElo(2599).name).toBe("Master");
    expect(tierForElo(2600).name).toBe("Grandmaster");
  });
  it("absurdly high ELO still resolves (top tier is open-ended)", () => {
    expect(tierForElo(99999).name).toBe("Grandmaster");
  });
});

describe("tierForElo — robustness", () => {
  it("returns Initiate as the safe fallback", () => {
    // Negative shouldn't happen with ELO_FLOOR=0, but should still be safe.
    expect(tierForElo(-100).name).toBe("Initiate");
  });
  it("works with an empty tier list (returns first / undefined-safe)", () => {
    // Not a realistic case, just guarding against future refactors.
    const fake = CLASSIC_TIERS.slice(0, 1);
    expect(tierForElo(50, fake).name).toBe("Initiate");
  });
});

describe("rankChange", () => {
  it("flags no change when staying in the same tier", () => {
    const r = rankChange(1500, 1520);
    expect(r.changed).toBe(false);
    expect(r.oldTier.name).toBe("Gold");
    expect(r.newTier.name).toBe("Gold");
  });
  it("flags a promotion when crossing up", () => {
    const r = rankChange(1390, 1410);
    expect(r.changed).toBe(true);
    if (r.changed) {
      expect(r.direction).toBe("promotion");
      expect(r.oldTier.name).toBe("Silver");
      expect(r.newTier.name).toBe("Gold");
    }
  });
  it("flags a demotion when crossing down", () => {
    const r = rankChange(1410, 1390);
    expect(r.changed).toBe(true);
    if (r.changed) {
      expect(r.direction).toBe("demotion");
      expect(r.oldTier.name).toBe("Gold");
      expect(r.newTier.name).toBe("Silver");
    }
  });
  it("identical ELOs are 'unchanged'", () => {
    const r = rankChange(1700, 1700);
    expect(r.changed).toBe(false);
  });
  it("crossing into Grandmaster is a promotion", () => {
    const r = rankChange(2595, 2605);
    expect(r.changed).toBe(true);
    if (r.changed) {
      expect(r.direction).toBe("promotion");
      expect(r.newTier.name).toBe("Grandmaster");
    }
  });
});
