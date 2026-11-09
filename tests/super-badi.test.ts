import { describe, expect, it } from "vitest";
import { joinNames, superBadiMessage, weekWinners, type WeekResult } from "@/lib/super-badi";

const r = (id: string, points: number, rest: Partial<WeekResult> = {}): WeekResult => ({ id, points, steps: 0, days: 0, ...rest });

describe("Super Badi of the week", () => {
  it("goes to the most points last week", () => {
    expect(weekWinners([r("a", 30), r("b", 41), r("c", 38)])).toEqual(["b"]);
  });

  it("breaks a tie on steps, then check-in days", () => {
    expect(weekWinners([r("a", 40, { steps: 71_000 }), r("b", 40, { steps: 64_000 })])).toEqual(["a"]);
    expect(weekWinners([r("a", 40, { steps: 70_000, days: 6 }), r("b", 40, { steps: 70_000, days: 7 })])).toEqual(["b"]);
  });

  it("is shared when level on everything, and nobody gets it without points", () => {
    expect(weekWinners([r("a", 40, { steps: 70_000, days: 7 }), r("b", 40, { steps: 70_000, days: 7 })])).toEqual(["a", "b"]);
    expect(weekWinners([r("a", 0), r("b", 0)])).toEqual([]);
    expect(weekWinners([])).toEqual([]);
  });

  it("writes Baddy's message for one or more winners", () => {
    expect(joinNames(["Sam", "Noor", "Alex"])).toBe("Sam, Noor en Alex");
    expect(superBadiMessage(["Irene"], 44)).toBe(
      "🏆 Gefeliciteerd Irene, jij was de Super Badi van vorige week met 44 punten! Hou je de kroon vast, of geef je de troon deze week aan iemand anders?",
    );
    expect(superBadiMessage(["Irene", "Daphne"], 40)).toContain("jullie waren samen de Super Badi");
  });
});
