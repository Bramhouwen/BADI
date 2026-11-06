import { describe, expect, it } from "vitest";
import { availablePrizes, challengeDays, challengeProgress, countdownLabel, formatChance, landingRotation, nextSpinAt, segments, wheelOdds, zonedMidnight, type ChallengeData, type PrizeLike } from "@/lib/wheel";

const prize = (id: string, category: PrizeLike["category"], rest: Partial<PrizeLike> = {}): PrizeLike => ({ id, category, active: true, stock: 1, weekly_max: null, ...rest });

describe("wheel odds", () => {
  it("leaves out categories without an available prize and rescales the rest", () => {
    const available = availablePrizes([prize("a", "food"), prize("b", "hydration", { stock: 0 }), prize("c", "sport", { active: false }), prize("d", "voucher", { weekly_max: 1 })], { d: 1 });
    expect(available.map((p) => p.id)).toEqual(["a"]);
    const odds = wheelOdds({ food: 40, hydration: 10, sport: 5, voucher: 10, challenge: 35 }, available);
    expect(odds.map((o) => o.category)).toEqual(["food", "challenge"]);
    expect(odds[0].chance).toBeCloseTo(40 / 75);
    expect(formatChance(odds[1].chance)).toBe("46,7%");
  });

  it("keeps the brief's split when everything is available", () => {
    const all = [prize("a", "food"), prize("b", "hydration"), prize("c", "sport"), prize("d", "voucher")];
    const odds = wheelOdds({ food: 40, hydration: 10, sport: 5, voucher: 10, challenge: 35 }, all);
    expect(odds.map((o) => formatChance(o.chance))).toEqual(["40%", "10%", "5%", "10%", "35%"]);
  });

  it("falls back to only the challenge when nothing has a weight", () => {
    expect(wheelOdds({ food: 0, hydration: 0, sport: 0, voucher: 0, challenge: 0 }, [])).toEqual([{ category: "challenge", weight: 1, chance: 1 }]);
  });

  it("draws equal slots for what can be won, neighbours in different colours", () => {
    const segs = segments(wheelOdds({ food: 40, hydration: 10, sport: 5, voucher: 10, challenge: 35 }, [prize("a", "food"), prize("d", "voucher")]));
    expect(segs.map((s) => s.label)).toEqual(["Drankje", "Challenge", "Cadeaubon", "Proteïnereep", "Challenge"]);
    expect(new Set(segs.map((s) => s.end - s.start)).size).toBe(1);
    segs.forEach((s, i) => expect(s.color).not.toBe(segs[(i + 1) % segs.length].color));
    // Only the challenge left: still a full wheel.
    expect(segments([{ category: "challenge" }]).length).toBe(4);
  });

  it("lands the pointer inside a slot of the chosen category after full turns", () => {
    const segs = segments(wheelOdds({}, [prize("a", "food"), prize("b", "hydration"), prize("c", "sport"), prize("d", "voucher")]));
    for (const r of [0, 0.3, 0.5, 0.8, 1]) {
      const rot = landingRotation(segs, "food", 123, r);
      expect(rot).toBeGreaterThan(123 + 5 * 360);
      // The angle under the pointer at the top, in wheel coordinates.
      const under = (360 - (rot % 360)) % 360;
      const hit = segs.find((s) => under > s.start && under < s.end)!;
      expect(hit.category).toBe("food");
    }
  });
});

describe("week challenges", () => {
  const empty: ChallengeData = { water: {}, checkins: {}, steps: {}, workoutDates: new Set(), buddies: [] };

  it("runs from the spin day to Sunday", () => {
    expect(challengeDays("2026-11-02", "2026-11-06")).toEqual(["2026-11-06", "2026-11-07", "2026-11-08"]);
  });

  it("tracks daily goals and marks missed days", () => {
    const data = { ...empty, water: { "2026-11-06": 2600, "2026-11-07": 1200 } };
    const p = challengeProgress("hydration", "2026-11-02", "2026-11-06", "2026-11-08", data);
    expect(p.steps.map((s) => s.state)).toEqual(["done", "missed", "open"]);
    expect(p).toMatchObject({ done: 1, total: 3, complete: false, failed: true });
  });

  it("completes food when both habits are ticked every day", () => {
    const data = { ...empty, checkins: { "2026-11-07": ["nutrition", "protein"], "2026-11-08": ["nutrition", "protein", "hydration"] } };
    expect(challengeProgress("food", "2026-11-02", "2026-11-07", "2026-11-08", data).complete).toBe(true);
  });

  it("counts movement from a workout, 10.000 steps or a ticked training", () => {
    const data = { ...empty, workoutDates: new Set(["2026-11-06"]), steps: { "2026-11-07": 10_500 }, checkins: { "2026-11-08": ["moved"] } };
    expect(challengeProgress("movement", "2026-11-02", "2026-11-06", "2026-11-08", data).complete).toBe(true);
  });

  it("needs a compliment for every squad member for the buddy challenge", () => {
    const data = { ...empty, buddies: [{ id: "a", name: "Sam", sent: true }, { id: "b", name: "Noor", sent: false }] };
    expect(challengeProgress("buddy", "2026-11-02", "2026-11-04", "2026-11-05", data)).toMatchObject({ done: 1, total: 2, complete: false, failed: false });
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
