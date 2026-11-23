import { describe, expect, it } from "vitest";
import { celebrationText, isStreakMilestone } from "@/lib/celebrate";
import { sheetFor, spriteKey, unreleasedKeys } from "@/lib/sprites";

describe("celebrations", () => {
  it("celebrates every full week of check-ins", () => {
    expect(isStreakMilestone(7)).toBe(true);
    expect(isStreakMilestone(14)).toBe(true);
    expect(isStreakMilestone(6)).toBe(false);
    expect(isStreakMilestone(0)).toBe(false);
  });

  it("has a line and a move for every moment", () => {
    expect(celebrationText({ kind: "streak", n: 14 }).text).toContain("14 dagen");
    expect(celebrationText({ kind: "steps" }).text).toContain("70.000");
    expect(celebrationText({ kind: "day" }).anim).toBe("happy");
    expect(celebrationText({ kind: "workout" }).anim).toBe("squat");
  });
});

describe("characters", () => {
  it("finds a live character by first name", () => {
    expect(sheetFor("Anne de Vries")?.src).toBe("/sprites/anne.webp");
    expect(sheetFor("anne")?.face).toBe("/sprites/anne-face.png");
    expect(sheetFor("Onbekend")).toBeNull();
    expect(spriteKey("  Irene  van Dam")).toBe("irene");
  });

  it("keeps a character out until the admin released it", () => {
    expect(sheetFor("Irene")).toBeNull();
    expect(sheetFor("Daphne")).toBeNull();
    expect(sheetFor("Irene", new Set(["irene"]))?.src).toBe("/sprites/irene.webp");
    expect(unreleasedKeys()).toEqual(expect.arrayContaining(["irene", "daphne"]));
    expect(unreleasedKeys()).not.toContain("anne");
  });
});
