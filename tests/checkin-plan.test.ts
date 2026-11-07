import { describe, expect, it } from "vitest";
import { DAILY_HABITS, WEEKLY_TARGETS, dailyScore, toggledSet, weekDates, weekProgress, weekStartOf } from "@/lib/checkin-plan";
import { ACTIVITY_KEYS } from "@/lib/constants";
import { effectiveActivities } from "@/lib/checkin-sources";
import { settingsFromRow } from "@/lib/notification-kinds";

describe("daily habits", () => {
  it("are the five daily principles; steps are a weekly goal", () => {
    expect(DAILY_HABITS).toEqual(["hydration", "nutrition", "protein", "recovery", "alcohol"]);
    expect(WEEKLY_TARGETS).toEqual({ run: 3, strength: 3 });
  });

  it("scores only daily habits, ignoring trainings and old keys", () => {
    expect(dailyScore(["steps", "hydration", "run", "moved"])).toEqual({ done: 1, total: 5, complete: false });
    expect(dailyScore(DAILY_HABITS)).toEqual({ done: 5, total: 5, complete: true });
  });

  it("counts a joker as the alcohol habit", () => {
    expect(dailyScore(["hydration"], true).done).toBe(2);
    expect(dailyScore(["hydration", "alcohol"], true).done).toBe(2);
  });
});

describe("weeks", () => {
  it("start on Monday", () => {
    expect(weekStartOf("2026-11-02")).toBe("2026-11-02");
    expect(weekStartOf("2026-11-08")).toBe("2026-11-02");
    expect(weekStartOf("2026-11-09")).toBe("2026-11-09");
    expect(weekDates("2026-11-02")).toHaveLength(7);
    expect(weekDates("2026-11-02")[6]).toBe("2026-11-08");
  });

  it("counts done and planned trainings against the targets", () => {
    const p = weekProgress(
      "2026-11-02",
      [
        { checkin_date: "2026-11-02", activities: ["run", "steps"] },
        { checkin_date: "2026-11-04", activities: ["strength", "run"] },
        { checkin_date: "2026-11-10", activities: ["run"] },
      ],
      [
        { plan_date: "2026-11-02", kind: "run" },
        { plan_date: "2026-11-05", kind: "strength" },
        { plan_date: "2026-11-07", kind: "run" },
      ],
      ["2026-11-06"],
    );
    expect(p.totals.run).toEqual({ done: 2, planned: 2, target: 3 });
    expect(p.totals.strength).toEqual({ done: 1, planned: 1, target: 3 });
    expect(p.days[0]).toMatchObject({ date: "2026-11-02", planned: ["run"], done: ["run"], habitsDone: 0 });
    expect(p.days[4].joker).toBe(true);
  });
});

describe("manual ticks", () => {
  it("toggle one part and keep the canonical order", () => {
    expect(toggledSet(["protein", "steps"], "hydration", true)).toEqual(["steps", "hydration", "protein"]);
    expect(toggledSet(["steps", "hydration"], "steps", false)).toEqual(["hydration"]);
  });

  it("merge manual, workout and water sources without double counting", () => {
    const sources = [
      { activity: "hydration", source: "manual" },
      { activity: "hydration", source: "water" },
      { activity: "run", source: "workout" },
      { activity: "steps", source: "manual" },
    ];
    expect(effectiveActivities(sources)).toEqual(["steps", "hydration", "run"]);
    expect(ACTIVITY_KEYS).toContain("protein");
  });
});

describe("notification settings", () => {
  it("default to everything on", () => {
    expect(settingsFromRow(null)).toEqual({ coach: true, direct: true, chat: true, mentions: true, recipes: true, jokers: true, compliments: true });
    expect(settingsFromRow({ chat: false }).chat).toBe(false);
  });
});

describe("steps per week", () => {
  it("scores 1 point per 10.000 steps in the week, at most 7", async () => {
    const { stepPoints, weekScore, WEEK_POINTS, WEEKLY_STEPS_GOAL } = await import("@/lib/checkin-plan");
    expect(WEEKLY_STEPS_GOAL).toBe(70_000);
    expect(WEEK_POINTS).toBe(48);
    expect(stepPoints(69_999)).toBe(6);
    expect(stepPoints(70_000)).toBe(7);
    expect(stepPoints(120_000)).toBe(7);
    // A quiet day is made up later in the week.
    const logs = [
      { log_date: "2026-11-02", steps: 4_000 },
      { log_date: "2026-11-03", steps: 16_000 },
    ];
    expect(weekScore("2026-11-02", [], [], logs).earned).toBe(2);
  });

  it("counts a day ticked before the change as 10.000, a typed count wins", async () => {
    const { stepsByDay } = await import("@/lib/checkin-plan");
    const days = stepsByDay(
      "2026-11-02",
      [{ log_date: "2026-11-03", steps: 7_500 }],
      [
        { checkin_date: "2026-11-02", activities: ["steps"] },
        { checkin_date: "2026-11-03", activities: ["steps"] },
        { checkin_date: "2026-11-09", activities: ["steps"] },
      ],
    );
    expect(days["2026-11-02"]).toBe(10_000);
    expect(days["2026-11-03"]).toBe(7_500);
    expect(days["2026-11-04"]).toBe(0);
    expect(Object.keys(days)).toHaveLength(7);
  });
});

describe("bonus points", () => {
  it("counts the Wall on up to 3 days and recipe, steps and challenge once, on top of the ring", async () => {
    const { weekBonus, weekScore } = await import("@/lib/checkin-plan");
    const items = [
      { kind: "wall" as const, date: "2026-11-03" },
      { kind: "wall" as const, date: "2026-11-03" },
      { kind: "wall" as const, date: "2026-11-04" },
      { kind: "wall" as const, date: "2026-11-05" },
      { kind: "wall" as const, date: "2026-11-06" },
      { kind: "recipe" as const, date: "2026-11-07" },
      { kind: "recipe" as const, date: "2026-11-08" },
      { kind: "steps" as const, date: "2026-11-02" },
      // Last week and next week do not count.
      { kind: "recipe" as const, date: "2026-11-01" },
      { kind: "wall" as const, date: "2026-11-09" },
    ];
    // Wall on 4 days counts 3, recipe once, steps once: 5 x 5.
    expect(weekBonus("2026-11-02", items)).toEqual({ counts: { wall: 3, recipe: 1, steps: 1, challenge: 0 }, points: 25 });
    expect(weekScore("2026-11-02", [], [], [], items)).toEqual({ earned: 0, bonus: 25, total: 48, fraction: 0 });
  });

  it("finds the weeks with the steps goal reached", async () => {
    const { stepsGoalWeeks } = await import("@/lib/checkin-plan");
    const logs = [
      { log_date: "2026-11-02", steps: 30_000 },
      { log_date: "2026-11-04", steps: 30_000 },
      { log_date: "2026-11-10", steps: 12_000 },
    ];
    // Week of 02-11: 60.000 typed + a ticked day without a count (10.000) = 70.000.
    const checkins = [{ checkin_date: "2026-11-06", activities: ["steps"] }];
    expect(stepsGoalWeeks("2026-11-02", "2026-11-12", logs, checkins)).toEqual(["2026-11-02"]);
    expect(stepsGoalWeeks("2026-11-02", "2026-11-12", logs, [])).toEqual([]);
  });

  it("finds personal records against earlier sessions only", async () => {
    const { personalRecords } = await import("@/lib/checkin-plan");
    const set = (weight_kg: number | null, repetitions: number | null, duration_seconds: number | null = null, completed = true) => ({ weight_kg, repetitions, duration_seconds, completed });
    const s = (date: string, exercise_id: string, measure: "reps" | "time", sets: ReturnType<typeof set>[], user_id = "a") => ({ user_id, date, created_at: `${date}T18:00:00Z`, exercise_id, measure, sets });
    const records = personalRecords([
      s("2026-11-01", "squat", "reps", [set(50, 10)]), // baseline
      s("2026-11-03", "squat", "reps", [set(55, 8), set(60, 1, null, false)]), // 55 > 50
      s("2026-11-05", "squat", "reps", [set(55, 10)]), // equal: no record
      s("2026-11-02", "plank", "time", [set(null, null, 60)]),
      s("2026-11-04", "plank", "time", [set(null, null, 75)]), // longer hold
      s("2026-11-02", "pushup", "reps", [set(null, 20)]),
      s("2026-11-06", "pushup", "reps", [set(null, 25)]), // more reps
      s("2026-11-03", "squat", "reps", [set(80, 5)], "b"), // other member's first: baseline
    ]);
    expect(records).toEqual([
      { user_id: "a", date: "2026-11-03" },
      { user_id: "a", date: "2026-11-04" },
      { user_id: "a", date: "2026-11-06" },
    ]);
  });
});
