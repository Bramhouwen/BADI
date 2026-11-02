import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { coverFor, exerciseMedia, FILMED_EXERCISES, videoSlug } from "@/lib/exercise-video";
import { motionFor } from "@/lib/exercise-motion/library";
import { targetLabel, templateSummary } from "@/lib/fitness";

describe("exercise videos", () => {
  it("turns names into file slugs", () => {
    expect(videoSlug("Bent-over Row")).toBe("bent-over-row");
    expect(videoSlug("Incline Dumbbell Press")).toBe("incline-dumbbell-press");
    expect(videoSlug("Cat-Cow")).toBe("cat-cow");
  });

  it("finds a clip regardless of case and punctuation", () => {
    expect(exerciseMedia("push up")).toEqual({ video: "/exercise-videos/push-up.mp4", poster: "/exercise-videos/push-up.jpg" });
    expect(exerciseMedia("Pushup")?.video).toBe("/exercise-videos/push-up.mp4");
    expect(exerciseMedia("Mijn eigen oefening")).toBeNull();
  });

  it("has a clip, a poster and how-to tips for every filmed exercise", () => {
    expect(FILMED_EXERCISES).toHaveLength(36);
    for (const name of FILMED_EXERCISES) {
      const media = exerciseMedia(name)!;
      for (const file of [media.video, media.poster]) {
        const path = join(process.cwd(), "public", file);
        expect(existsSync(path), file).toBe(true);
        // Clips stay small enough for mobile data.
        expect(statSync(path).size, file).toBeLessThan(900_000);
      }
      expect(motionFor(name)?.cues.length, name).toBeGreaterThanOrEqual(2);
    }
  });

  it("uses the first filmed exercise as workout cover", () => {
    expect(coverFor(["Eigen oefening", "Lat Pulldown", "Squat"])?.name).toBe("Lat Pulldown");
    expect(coverFor(["Eigen oefening"])).toBeNull();
  });
});

describe("workout summary", () => {
  it("counts sets and estimates minutes in steps of five", () => {
    expect(templateSummary([{ target_sets: 3 }, { target_sets: 3 }, { target_sets: 4 }])).toEqual({ exercises: 3, sets: 10, minutes: 25 });
    expect(templateSummary([{ target_sets: 1 }])).toEqual({ exercises: 1, sets: 1, minutes: 5 });
    expect(templateSummary([])).toEqual({ exercises: 0, sets: 0, minutes: 0 });
  });

  it("labels targets", () => {
    expect(targetLabel({ target_sets: 3, target_reps: 10, target_weight_kg: 20 })).toBe("3 × 10 · 20 kg");
    expect(targetLabel({ target_sets: 3, target_reps: 10, target_weight_kg: null })).toBe("3 × 10");
    expect(targetLabel({ target_sets: 1, target_reps: null, target_weight_kg: null })).toBe("1 set");
  });
});
