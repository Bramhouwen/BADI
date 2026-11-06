import { describe, expect, it } from "vitest";
import {
  availablePrizes,
  budgetWarning,
  challengeProgress,
  countdownLabel,
  expectedCost,
  formatChance,
  landingRotation,
  nextSpinAt,
  prizeChances,
  segments,
  unavailableReason,
  wheelOdds,
  zonedMidnight,
  type ChallengeData,
  type PrizeLike,
} from "@/lib/wheel";

const prize = (id: string, category: PrizeLike["category"], rest: Partial<PrizeLike> = {}): PrizeLike => ({
  id,
  category,
  active: true,
  stock: 1,
  weekly_max: null,
  weight: 10,
  cost_cents: 0,
  sponsored_cents: 0,
  shipping_cents: 0,
  ...rest,
});
const all = [prize("s", "small"), prize("m", "medium"), prize("l", "large"), prize("j", "jackpot")];

describe("wheel odds", () => {
  it("uses the brief's split when every level has a prize", () => {
    expect(wheelOdds({}, all).map((o) => [o.category, formatChance(o.chance)])).toEqual([
      ["small", "35%"],
      ["medium", "20%"],
      ["large", "8%"],
      ["jackpot", "2%"],
      ["challenge", "35%"],
    ]);
  });

  it("drops an empty level and keeps the ratio of the others", () => {
    const odds = wheelOdds({}, [prize("s", "small"), prize("m", "medium")]);
    expect(odds.map((o) => o.category)).toEqual(["small", "medium", "challenge"]);
    expect(odds[0].chance).toBeCloseTo(35 / 90);
    expect(odds[2].chance).toBeCloseTo(35 / 90);
  });

  it("falls back to only the challenge when nothing has a chance", () => {
    expect(wheelOdds({ small: 0, medium: 0, large: 0, jackpot: 0, challenge: 0 }, [])).toEqual([{ category: "challenge", weight: 1, chance: 1 }]);
  });

  it("splits a level's chance over its products by weight", () => {
    const pool = [prize("bar", "small", { weight: 30 }), prize("drink", "small", { weight: 10 }), prize("fles", "jackpot", { weight: 2 })];
    const chances = prizeChances(wheelOdds({}, pool), pool);
    // Small and jackpot remain: 35 / 72 and 2 / 72 of the spins.
    expect(chances.get("bar")).toBeCloseTo((35 / 72) * 0.75);
    expect(chances.get("drink")).toBeCloseTo((35 / 72) * 0.25);
    expect(chances.get("fles")).toBeCloseTo(2 / 72);
  });
});

describe("availability and budget", () => {
  it("computes the expected cost per prize", () => {
    expect(expectedCost({ cost_cents: 1800, shipping_cents: 495, sponsored_cents: 0 })).toBe(2295);
    expect(expectedCost({ cost_cents: 1500, shipping_cents: 0, sponsored_cents: 2000 })).toBe(0);
  });

  it("gives the reason a prize cannot be won", () => {
    expect(unavailableReason(prize("a", "small", { active: false }), {}, null)).toBe("inactive");
    expect(unavailableReason(prize("a", "small", { stock: 0 }), {}, null)).toBe("stock");
    expect(unavailableReason(prize("a", "small", { weekly_max: 1 }), { a: 1 }, null)).toBe("weekly");
    expect(unavailableReason(prize("a", "small", { cost_cents: 500 }), {}, 400)).toBe("budget");
    expect(unavailableReason(prize("a", "small", { cost_cents: 500 }), {}, null)).toBeNull();
    expect(availablePrizes([prize("a", "small", { cost_cents: 500 }), prize("b", "small", { cost_cents: 300 })], {}, 400).map((p) => p.id)).toEqual(["b"]);
  });

  it("warns when the budget no longer covers every prize", () => {
    const pool = [prize("a", "small", { cost_cents: 300 }), prize("b", "jackpot", { cost_cents: 3000 })];
    expect(budgetWarning(null, pool)).toBeNull();
    expect(budgetWarning(5000, pool)).toBeNull();
    expect(budgetWarning(1000, pool)).toBe("low");
    expect(budgetWarning(200, pool)).toBe("empty");
  });
});

describe("wheel face", () => {
  it("sizes every slice by the real chance", () => {
    const segs = segments(wheelOdds({}, all));
    const total = (c: string) => segs.filter((s) => s.category === c).reduce((a, s) => a + s.end - s.start, 0);
    expect(total("small")).toBeCloseTo(126);
    expect(total("challenge")).toBeCloseTo(126);
    expect(total("medium")).toBeCloseTo(72);
    expect(total("large")).toBeCloseTo(28.8);
    expect(total("jackpot")).toBeCloseTo(7.2);
    expect(segs[segs.length - 1].end).toBeCloseTo(360);
    // Only the challenge left: still a full wheel.
    expect(segments([{ category: "challenge", chance: 1 }]).length).toBe(4);
  });

  it("lands the pointer inside a slice of the chosen level after full turns", () => {
    const segs = segments(wheelOdds({}, all));
    for (const level of ["small", "jackpot", "challenge"] as const) {
      for (const r of [0, 0.3, 0.5, 0.8, 1]) {
        const rot = landingRotation(segs, level, 123, r);
        expect(rot).toBeGreaterThan(123 + 5 * 360);
        // The angle under the pointer at the top, in wheel coordinates.
        const under = (360 - (rot % 360)) % 360;
        expect(segs.find((s) => under > s.start && under < s.end)!.category).toBe(level);
      }
    }
  });
});

describe("week challenges", () => {
  const empty: ChallengeData = { buddies: [], recipes: 0, completedAt: null };

  it("needs a compliment for every squad member for the buddy challenge", () => {
    const data = { ...empty, buddies: [{ id: "a", name: "Sam", sent: true }, { id: "b", name: "Noor", sent: false }] };
    expect(challengeProgress("buddy", "2026-11-02", "2026-11-05", data)).toMatchObject({ done: 1, total: 2, complete: false, failed: false });
    // After Sunday an open step is missed.
    expect(challengeProgress("buddy", "2026-11-02", "2026-11-09", data)).toMatchObject({ complete: false, failed: true });
  });

  it("completes the recipe challenge with a recipe this week", () => {
    expect(challengeProgress("recipe", "2026-11-02", "2026-11-05", empty).complete).toBe(false);
    expect(challengeProgress("recipe", "2026-11-02", "2026-11-05", { ...empty, recipes: 1 }).complete).toBe(true);
  });

  it("completes a manual challenge once it is marked done", () => {
    for (const key of ["energizer", "lunch", "relax"] as const) {
      expect(challengeProgress(key, "2026-11-02", "2026-11-05", empty)).toMatchObject({ complete: false, failed: false });
      expect(challengeProgress(key, "2026-11-02", "2026-11-05", { ...empty, completedAt: "2026-11-04T18:00:00Z" }).complete).toBe(true);
      expect(challengeProgress(key, "2026-11-02", "2026-11-10", empty).failed).toBe(true);
    }
  });
});

describe("timing", () => {
  it("finds Monday 00:00 in Amsterdam, also across the clock change", () => {
    expect(zonedMidnight("2026-11-09", "Europe/Amsterdam").toISOString()).toBe("2026-11-08T23:00:00.000Z");
    expect(zonedMidnight("2026-07-06", "Europe/Amsterdam").toISOString()).toBe("2026-07-05T22:00:00.000Z");
    expect(nextSpinAt("2026-11-02", "Europe/Amsterdam").toISOString()).toBe("2026-11-08T23:00:00.000Z");
  });

  it("formats the countdown", () => {
    expect(countdownLabel((2 * 24 * 60 + 5 * 60 + 3) * 60_000)).toBe("2 d 5 u");
    expect(countdownLabel((5 * 60 + 12) * 60_000)).toBe("5 u 12 min");
    expect(countdownLabel(12 * 60_000)).toBe("12 min");
  });
});
