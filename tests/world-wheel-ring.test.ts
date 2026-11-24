import { describe, expect, it } from "vitest";
import { WHEEL_SQUARES, isSquare, ringState, wheelEase } from "@/lib/world/wheel-ring";
import { SCENES } from "@/lib/world/scenes";

const all = ["anne", "bram", "daphne", "irene"];
const at = (pairs: [string, string][]) => new Map(pairs);

describe("Weekrad in the back garden", () => {
  it("has four squares in the back garden, left to right", () => {
    const squares = SCENES.achtertuin.spots.filter((s) => isSquare(s.id));
    expect(squares.map((s) => s.id)).toEqual([...WHEEL_SQUARES]);
    for (let i = 1; i < squares.length; i++) expect(squares[i].at[0]).toBeGreaterThan(squares[i - 1].at[0]);
  });

  it("stays closed until everyone stands in a square", () => {
    const r = ringState(all, at([["bram", "vak-1"], ["anne", "vak-3"], ["irene", "vak-4"]]), new Set());
    expect(r.complete).toBe(false);
    expect(r.missing).toEqual(["daphne"]);
    expect(r.turn).toBeNull();
  });

  it("goes by square once everyone is there, skipping who already spun", () => {
    const standing = at([["irene", "vak-1"], ["bram", "vak-2"], ["anne", "vak-3"], ["daphne", "vak-4"]]);
    expect(ringState(all, standing, new Set()).turn).toBe("irene");
    expect(ringState(all, standing, new Set(["irene"])).turn).toBe("bram");
    expect(ringState(all, standing, new Set(["irene", "bram", "anne"])).turn).toBe("daphne");
    const done = ringState(all, standing, new Set(all));
    expect(done.turn).toBeNull();
    expect(done.done).toBe(true);
  });

  it("ignores someone outside the group and anything that is not a square", () => {
    const r = ringState(all, at([["bram", "vak-1"], ["anne", "vak-2"], ["daphne", "vak-3"], ["irene", "bank-links-1"], ["gast", "vak-4"]]), new Set());
    expect(r.complete).toBe(false);
    expect(r.missing).toEqual(["irene"]);
    expect(r.order.map((o) => o.id)).toEqual(["bram", "anne", "daphne"]);
  });

  it("slows down to a stop", () => {
    expect(wheelEase(0)).toBe(0);
    expect(wheelEase(1)).toBe(1);
    expect(wheelEase(0.5)).toBeGreaterThan(0.9);
  });
});
