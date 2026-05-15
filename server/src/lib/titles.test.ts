import { describe, expect, it } from "vitest";
import { isTitleUnlocked, TITLES } from "./titles.js";

describe("isTitleUnlocked", () => {
  it("empty title (no equip) is always 'unlocked'", () => {
    expect(isTitleUnlocked("", 0)).toBe(true);
    expect(isTitleUnlocked("", 5000)).toBe(true);
  });

  it("unknown title id → locked", () => {
    expect(isTitleUnlocked("nonexistent-title", 5000)).toBe(false);
  });

  it("apprentice unlocks at 800 peak", () => {
    expect(isTitleUnlocked("apprentice", 799)).toBe(false);
    expect(isTitleUnlocked("apprentice", 800)).toBe(true);
    expect(isTitleUnlocked("apprentice", 1500)).toBe(true);
  });

  it("scholar unlocks at 1400 peak", () => {
    expect(isTitleUnlocked("scholar", 1399)).toBe(false);
    expect(isTitleUnlocked("scholar", 1400)).toBe(true);
  });

  it("grandmaster unlocks at 2600 peak", () => {
    expect(isTitleUnlocked("grandmaster", 2599)).toBe(false);
    expect(isTitleUnlocked("grandmaster", 2600)).toBe(true);
  });

  it("titles persist once unlocked (peak-based, not current)", () => {
    // The spec is peak ELO — if you ever hit 2600, you keep the title even if
    // you tumble back to Silver. The function only takes peak, so verify it
    // accepts that contract.
    expect(isTitleUnlocked("grandmaster", 2700)).toBe(true);
  });

  it("every catalogued title (with id) has a positive unlock threshold", () => {
    for (const t of TITLES) {
      if (t.id === "") continue;
      expect(t.unlockAt).toBeGreaterThan(0);
    }
  });

  it("titles array is sorted by unlock threshold ascending", () => {
    const sorted = [...TITLES].sort((a, b) => a.unlockAt - b.unlockAt);
    expect(TITLES.map((t) => t.id)).toEqual(sorted.map((t) => t.id));
  });

  it("each title can be looked up by its own id", () => {
    for (const t of TITLES) {
      // A player exactly at the unlock threshold should unlock it.
      expect(isTitleUnlocked(t.id, t.unlockAt)).toBe(true);
    }
  });
});
