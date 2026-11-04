import { describe, expect, it } from "vitest";
import { superBadi, type SuperBadiInput } from "@/lib/super-badi";

const m = (id: string, streak: number, rest: Partial<SuperBadiInput> = {}): SuperBadiInput => ({ id, streak, weekPoints: 0, weekSteps: 0, totalDays: streak, checkedInAt: null, ...rest });

describe("Super Badi", () => {
  it("goes to the longest streak", () => {
    expect([...superBadi([m("a", 3, { weekPoints: 30 }), m("b", 5, { weekPoints: 10 }), m("c", 4, { weekPoints: 40 })])]).toEqual(["b"]);
  });

  it("breaks a tie on week points, then steps, then check-in days, then the earliest check-in today", () => {
    expect([...superBadi([m("a", 4, { weekPoints: 20 }), m("b", 4, { weekPoints: 25 })])]).toEqual(["b"]);
    expect([...superBadi([m("a", 4, { weekPoints: 25, weekSteps: 41_000 }), m("b", 4, { weekPoints: 25, weekSteps: 38_500 })])]).toEqual(["a"]);
    expect([...superBadi([m("a", 4, { totalDays: 6 }), m("b", 4, { totalDays: 9 })])]).toEqual(["b"]);
    expect([...superBadi([m("a", 4, { checkedInAt: "2026-11-04T09:30:00Z" }), m("b", 4, { checkedInAt: "2026-11-04T07:10:00Z" }), m("c", 4)])]).toEqual(["b"]);
  });

  it("is shared only when members are level on everything, and nobody gets it without a streak", () => {
    expect(superBadi([m("a", 2, { weekPoints: 10 }), m("b", 2, { weekPoints: 10 })]).size).toBe(2);
    expect(superBadi([m("a", 0, { weekPoints: 12 }), m("b", 0)]).size).toBe(0);
    expect(superBadi([]).size).toBe(0);
  });
});
