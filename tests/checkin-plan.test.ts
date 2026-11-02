import { describe, expect, it } from "vitest";
import { DAILY_HABITS, WEEKLY_TARGETS, dailyScore, toggledSet, weekDates, weekProgress, weekStartOf } from "@/lib/checkin-plan";
import { ACTIVITY_KEYS } from "@/lib/constants";
import { effectiveActivities } from "@/lib/checkin-sources";
import { settingsFromRow } from "@/lib/notification-kinds";

describe("daily habits", () => {
  it("are the six daily principles", () => {
    expect(DAILY_HABITS).toEqual(["steps", "hydration", "nutrition", "protein", "recovery", "alcohol"]);
    expect(WEEKLY_TARGETS).toEqual({ run: 3, strength: 3 });
  });

  it("scores only daily habits, ignoring trainings and old keys", () => {
    expect(dailyScore(["steps", "hydration", "run", "moved"])).toEqual({ done: 2, total: 6, complete: false });
    expect(dailyScore(DAILY_HABITS)).toEqual({ done: 6, total: 6, complete: true });
  });

  it("counts a joker as the alcohol habit", () => {
    expect(dailyScore(["steps"], true).done).toBe(2);
    expect(dailyScore(["steps", "alcohol"], true).done).toBe(2);
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
    expect(p.days[0]).toMatchObject({ date: "2026-11-02", planned: ["run"], done: ["run"], habitsDone: 1 });
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
    expect(settingsFromRow(null)).toEqual({ coach: true, chat: true, mentions: true, recipes: true, jokers: true, compliments: true });
    expect(settingsFromRow({ chat: false }).chat).toBe(false);
  });
});
