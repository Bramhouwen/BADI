import { describe, expect, it } from "vitest";
import {
  activityMeta,
  formatPace,
  mostWorkoutsInAWeek,
  paceSecPerKm,
  runningProgress,
  sessionVolumeKg,
  speedKmh,
  strengthRecords,
  timerElapsed,
  weekStart,
  weekStats,
  weeklyBuckets,
} from "@/lib/fitness";
import { effectiveActivities } from "@/lib/checkin-sources";

describe("pace and speed", () => {
  it("computes pace in seconds per km", () => {
    expect(paceSecPerKm(5000, 1500)).toBe(300);
    expect(formatPace(paceSecPerKm(5000, 1500))).toBe("5:00 /km");
    expect(formatPace(paceSecPerKm(5200, 1860))).toBe("5:58 /km");
  });

  it("never divides by zero", () => {
    expect(paceSecPerKm(0, 1500)).toBeNull();
    expect(paceSecPerKm(5000, 0)).toBeNull();
    expect(paceSecPerKm(null, undefined)).toBeNull();
    expect(speedKmh(0, 0)).toBeNull();
    expect(formatPace(null)).toBe("–");
  });

  it("computes cycling speed in km/h", () => {
    expect(speedKmh(30000, 3600)).toBe(30);
    expect(speedKmh(20000, 2400)).toBeCloseTo(30, 5);
  });
});

describe("training volume", () => {
  it("sums weight × reps over completed sets only", () => {
    const sets = [
      { weight_kg: 40, repetitions: 12, completed: true },
      { weight_kg: 50, repetitions: 10, completed: true },
      { weight_kg: 55, repetitions: 8, completed: false },
    ];
    expect(sessionVolumeKg(sets)).toBe(40 * 12 + 50 * 10);
  });

  it("gives bodyweight sets no fictional weight", () => {
    expect(sessionVolumeKg([{ weight_kg: null, repetitions: 15, completed: true }])).toBe(0);
  });
});

const sessions = [
  { id: "a", activity_type: "run", workout_date: "2026-11-02", duration_seconds: 1500, distance_meters: 5000, status: "completed", title: "Run" },
  { id: "b", activity_type: "walk", workout_date: "2026-11-02", duration_seconds: 2700, distance_meters: 4000, status: "completed", title: "Walk" },
  { id: "c", activity_type: "strength", workout_date: "2026-11-04", duration_seconds: 3000, distance_meters: null, status: "completed", title: "Lower" },
  { id: "d", activity_type: "run", workout_date: "2026-10-27", duration_seconds: 3600, distance_meters: 10000, status: "completed", title: "Long run" },
  { id: "e", activity_type: "run", workout_date: "2026-11-05", duration_seconds: 1400, distance_meters: 5100, status: "draft", title: "Draft" },
];

describe("week statistics", () => {
  it("uses Monday-based weeks", () => {
    expect(weekStart("2026-11-02")).toBe("2026-11-02"); // Monday
    expect(weekStart("2026-11-08")).toBe("2026-11-02"); // Sunday
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
  });

  it("counts workouts, minutes, distance and unique active days, ignoring drafts", () => {
    const w = weekStats(sessions, "2026-11-05");
    expect(w.workouts).toBe(3);
    expect(w.seconds).toBe(1500 + 2700 + 3000);
    expect(w.meters).toBe(9000);
    expect(w.activeDays).toBe(2); // two workouts on 2 Nov count once
  });

  it("buckets the last weeks oldest first", () => {
    const b = weeklyBuckets(sessions, "2026-11-05", 2);
    expect(b.map((x) => x.start)).toEqual(["2026-10-26", "2026-11-02"]);
    expect(b[0].workouts).toBe(1);
    expect(b[1].workouts).toBe(3);
  });

  it("finds the busiest week", () => {
    expect(mostWorkoutsInAWeek(sessions)).toEqual({ count: 3, weekStart: "2026-11-02" });
  });
});

describe("running progress", () => {
  it("tracks longest distance and a reliable fastest 5 km only", () => {
    const r = runningProgress(sessions);
    expect(r.longestMeters).toBe(10000);
    // The 10 km run is not a 5 km performance; the 5,0 km run is.
    expect(r.fastest5kSeconds).toBe(1500);
    expect(r.runs.map((x) => x.id)).toEqual(["d", "a"]);
  });

  it("has no 5 km record without a qualifying run", () => {
    expect(runningProgress([sessions[3]]).fastest5kSeconds).toBeNull();
  });
});

describe("strength records", () => {
  it("derives max weight, best volume and history per exercise", () => {
    const rows = [
      { sessionId: "s1", date: "2026-11-01", exerciseId: "sq", name: "Squat", sets: [{ weight_kg: 50, repetitions: 10, completed: true }, { weight_kg: 60, repetitions: 8, completed: true }] },
      { sessionId: "s2", date: "2026-11-04", exerciseId: "sq", name: "Squat", sets: [{ weight_kg: 65, repetitions: 5, completed: true }, { weight_kg: 70, repetitions: 3, completed: false }] },
    ];
    const [rec] = strengthRecords(rows);
    expect(rec.maxWeightKg).toBe(65);
    expect(rec.maxWeightDate).toBe("2026-11-04");
    expect(rec.bestSessionVolumeKg).toBe(50 * 10 + 60 * 8);
    expect(rec.history).toHaveLength(2);
  });
});

describe("check-in link", () => {
  it("maps runs to run, strength to strength and everything else to other training", () => {
    expect(activityMeta("run").checkin).toEqual(["run"]);
    expect(activityMeta("strength").checkin).toEqual(["strength"]);
    expect(activityMeta("walk").checkin).toEqual(["moved"]);
    expect(activityMeta("unknown").checkin).toEqual(["moved"]);
  });

  it("never double counts a category across manual ticks and workouts", () => {
    const sources = [
      { activity: "moved", source: "manual" },
      { activity: "moved", source: "workout" },
      { activity: "moved", source: "workout" },
      { activity: "strength", source: "workout" },
    ];
    expect(effectiveActivities(sources)).toEqual(["strength", "moved"]);
  });

  it("keeps a manual tick when the workout support disappears", () => {
    expect(effectiveActivities([{ activity: "moved", source: "manual" }])).toEqual(["moved"]);
    expect(effectiveActivities([])).toEqual([]);
  });
});

describe("timer", () => {
  it("is based on timestamps, so background time still counts", () => {
    const t0 = 1_700_000_000_000;
    expect(timerElapsed({ startedAt: t0, accumulated: 60 }, t0 + 125_000)).toBe(185);
    expect(timerElapsed({ startedAt: null, accumulated: 60 }, t0 + 125_000)).toBe(60);
  });
});
