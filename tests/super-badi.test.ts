import { describe, expect, it } from "vitest";
import { superBadi } from "@/lib/super-badi";

const m = (id: string, streak: number, weekPoints = 0, totalDays = streak) => ({ id, streak, weekPoints, totalDays });

describe("Super Badi", () => {
  it("goes to the longest streak", () => {
    expect([...superBadi([m("a", 3, 30), m("b", 5, 10), m("c", 4, 40)])]).toEqual(["b"]);
  });

  it("breaks a tie on week points, then on check-in days", () => {
    expect([...superBadi([m("a", 4, 20), m("b", 4, 25)])]).toEqual(["b"]);
    expect([...superBadi([m("a", 4, 25, 6), m("b", 4, 25, 9)])]).toEqual(["b"]);
  });

  it("is shared when members are fully level, and nobody gets it without a streak", () => {
    expect(superBadi([m("a", 2, 10), m("b", 2, 10)]).size).toBe(2);
    expect(superBadi([m("a", 0, 12), m("b", 0, 3)]).size).toBe(0);
    expect(superBadi([]).size).toBe(0);
  });
});
