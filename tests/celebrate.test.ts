import { describe, expect, it } from "vitest";
import { celebrationText, isStreakMilestone } from "@/lib/celebrate";
import { pushIconFor, spriteFor } from "@/lib/sprites";

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
  it("finds a character by first name", () => {
    expect(spriteFor("Anne de Vries")?.src).toBe("/sprites/anne.webp");
    expect(spriteFor("anne")?.face).toBe("/sprites/anne-face.png");
  });

  it("uses the face as push icon only for members with a character", () => {
    expect(pushIconFor("Anne")).toBe("/sprites/anne-face.png");
    expect(pushIconFor("Onbekend")).toBeUndefined();
  });
});

describe("release", () => {
  it("keeps a character that is not released yet out of the app", () => {
    expect(spriteFor("Irene")).toBeNull();
    expect(pushIconFor("Irene")).toBeUndefined();
    expect(spriteFor("Daphne")).toBeNull();
  });
});
