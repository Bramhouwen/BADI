import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MOBILITY_EXERCISES, motionFor, motionKey, MOTIONS } from "@/lib/exercise-motion/library";
import { blendSide, cyclePosition, dir, frontJoints, lerpAngle, sideJoints } from "@/lib/exercise-motion/skeleton";

const STANDARD = ["Squat", "Leg Press", "Lunges", "Romanian Deadlift", "Leg Extension", "Leg Curl", "Calf Raise", "Bench Press", "Incline Dumbbell Press", "Chest Fly", "Push-up", "Lat Pulldown", "Seated Row", "Bent-over Row", "Pull-up", "Shoulder Press", "Lateral Raise", "Rear Delt Fly", "Bicep Curl", "Hammer Curl", "Tricep Pushdown", "Tricep Extension", "Plank", "Crunch", "Leg Raise", "Russian Twist"];

describe("exercise demos", () => {
  it("has a demo with two or three tips for every standard and mobility exercise", () => {
    for (const name of [...STANDARD, ...MOBILITY_EXERCISES]) {
      const m = motionFor(name);
      expect(m, name).not.toBeNull();
      expect(m!.frames.length, name).toBeGreaterThanOrEqual(2);
      expect(m!.cues.length, name).toBeGreaterThanOrEqual(2);
      expect(m!.cues.length, name).toBeLessThanOrEqual(3);
    }
  });

  it("matches names regardless of case and punctuation", () => {
    expect(motionKey("Push-up")).toBe(motionKey("push up"));
    expect(motionFor("PUSHUP")).toBe(MOTIONS.pushup);
    expect(motionFor("Mijn eigen oefening")).toBeNull();
  });

  it("adds exactly the mobility exercises in migration 0018", () => {
    const sql = readFileSync("supabase/migrations/0018_mobility_exercises.sql", "utf8");
    for (const name of MOBILITY_EXERCISES) expect(sql).toContain(`('${name}')`);
  });

  it("keeps every joint of every frame on the canvas", () => {
    for (const [key, m] of Object.entries(MOTIONS)) {
      for (const f of m.frames) {
        const j = m.view === "side" ? sideJoints(f as never) : frontJoints(f as never);
        for (const v of Object.values(j).flat(3).filter((x): x is number => typeof x === "number")) expect(Number.isFinite(v), key).toBe(true);
      }
    }
  });
});

describe("figure geometry", () => {
  it("uses 0 for down, 90 for forward and 180 for up", () => {
    expect(dir(0)[1]).toBeCloseTo(1);
    expect(dir(90)[0]).toBeCloseTo(1);
    expect(dir(180)[1]).toBeCloseTo(-1);
  });

  it("blends angles the short way round", () => {
    expect(lerpAngle(350, 10, 0.5)).toBeCloseTo(360);
    expect(lerpAngle(10, 350, 0.5)).toBeCloseTo(0);
  });

  it("puts the feet 60 below the hip when standing", () => {
    const j = sideJoints({ hip: [100, 116], torso: 180, arms: [[0, 0], [0, 0]], legs: [[0, 0], [0, 0]] });
    expect(j.legs[0].ankle[1]).toBeCloseTo(176);
    expect(j.shoulder[1]).toBeCloseTo(66);
  });

  it("blends halfway between two poses", () => {
    const a = { hip: [100, 116] as [number, number], torso: 180, arms: [[0, 0], [0, 0]] as never, legs: [[0, 0], [0, 0]] as never };
    const b = { ...a, torso: 140 };
    expect(blendSide(a, b, 0.5).torso).toBeCloseTo(160);
  });

  it("goes through the frames and back in a loop", () => {
    expect(cyclePosition(3, 0, 1000)).toMatchObject({ from: 0, to: 1 });
    expect(cyclePosition(3, 1000, 1000)).toMatchObject({ from: 1, to: 2 });
    expect(cyclePosition(3, 2000, 1000)).toMatchObject({ from: 2, to: 1 });
    expect(cyclePosition(3, 3000, 1000)).toMatchObject({ from: 1, to: 0 });
    expect(cyclePosition(2, 500, 1000, 0).t).toBeCloseTo(0.5);
  });
});
