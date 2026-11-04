import { describe, expect, it } from "vitest";
import { PREP_SECONDS, clock, holdPhase } from "@/components/fitness/hold-timer";

describe("hold timer", () => {
  it("gives five seconds to get ready, then counts down from the target", () => {
    const t0 = 1_000_000;
    expect(holdPhase(t0, t0, 45)).toEqual({ kind: "prep", left: PREP_SECONDS });
    expect(holdPhase(t0, t0 + 4200, 45)).toEqual({ kind: "prep", left: 1 });
    expect(holdPhase(t0, t0 + 5000, 45)).toEqual({ kind: "hold", held: 0, left: 45 });
    expect(holdPhase(t0, t0 + 35_500, 45)).toEqual({ kind: "hold", held: 30, left: 15 });
    expect(holdPhase(t0, t0 + 60_000, 45)).toEqual({ kind: "hold", held: 55, left: 0 });
  });

  it("counts up without a target", () => {
    expect(holdPhase(0, 17_000, null)).toEqual({ kind: "hold", held: 12, left: null });
  });

  it("shows minutes and seconds", () => {
    expect(clock(45)).toBe("0:45");
    expect(clock(90)).toBe("1:30");
  });
});
