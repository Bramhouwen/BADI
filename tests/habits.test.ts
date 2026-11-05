import { describe, expect, it } from "vitest";
import { MAX_HABITS, cleanEmoji, cleanHabitName, habitWeek, moveId, parseMemberHabits } from "@/lib/habits";
import { DEFAULT_SHARING, sharingFromRow, sharingToRow } from "@/lib/squad-stats";
import { contextBlock, type CoachContext } from "@/lib/coach/prompt";
import { weekScore } from "@/lib/checkin-plan";

describe("habit names and emoji", () => {
  it("trims and collapses spaces, rejects empty or too long names", () => {
    expect(cleanHabitName("  10   minuten  lezen ")).toBe("10 minuten lezen");
    expect(cleanHabitName("   ")).toBeNull();
    expect(cleanHabitName("x".repeat(41))).toBeNull();
    expect(cleanHabitName(42)).toBeNull();
  });

  it("keeps one emoji, also when it is built from several code points", () => {
    expect(cleanEmoji("📖")).toBe("📖");
    expect(cleanEmoji(" 🏃‍♀️ ")).toBe("🏃‍♀️");
    expect(cleanEmoji("💊📖")).toBe("💊");
    expect(cleanEmoji("")).toBeNull();
    expect(cleanEmoji("a")).toBeNull();
  });

  it("allows six habits", () => {
    expect(MAX_HABITS).toBe(6);
  });
});

describe("habit week and order", () => {
  it("marks ticked days Monday to Sunday", () => {
    expect(habitWeek(["2026-11-02", "2026-11-04", "2026-11-09"], "2026-11-02")).toEqual([true, false, true, false, false, false, false]);
  });

  it("moves an item up or down and leaves the edges alone", () => {
    expect(moveId(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
    expect(moveId(["a", "b", "c"], "a", "up")).toEqual(["a", "b", "c"]);
    expect(moveId(["a", "b", "c"], "x", "down")).toEqual(["a", "b", "c"]);
  });
});

describe("shared habits", () => {
  it("shows nothing unless the database says the habits are shared", () => {
    expect(parseMemberHabits(null)).toEqual({ shared: false, habits: [] });
    expect(parseMemberHabits({ shared: false, habits: [{ id: "h", name: "Lezen", dates: [] }] })).toEqual({ shared: false, habits: [] });
  });

  it("keeps valid habits and dates only", () => {
    const r = parseMemberHabits({ shared: true, habits: [{ id: "h1", name: "Lezen", emoji: "📖", dates: ["2026-11-02", "bad", 3] }, { id: 5, name: "x" }, { id: "h2", name: "" }] });
    expect(r).toEqual({ shared: true, habits: [{ id: "h1", name: "Lezen", emoji: "📖", dates: ["2026-11-02"] }] });
  });

  it("shares habits by default and stores the switch", () => {
    expect(DEFAULT_SHARING.habits).toBe(true);
    expect(sharingFromRow({ share_habits: false }).habits).toBe(false);
    expect(sharingToRow({ ...DEFAULT_SHARING, habits: false }).share_habits).toBe(false);
  });
});

describe("Baddy context", () => {
  const base: CoachContext = {
    firstName: "Anne",
    today: "2 november 2026",
    weekday: "maandag",
    challengeDay: 2,
    challengeLength: 61,
    checkedInToday: false,
    todayActivities: [],
    streak: 0,
    longestStreak: 0,
    daysCheckedIn: 0,
    waterTodayMl: 0,
    waterGoalMl: 2500,
    workoutsThisWeek: 0,
    minutesThisWeek: 0,
    kmThisWeek: 0,
    recentWorkouts: [],
    alcoholExceptionsUsed: 0,
  };

  it("mentions own habits and that they do not count toward the score", () => {
    const text = contextBlock({ ...base, ownHabits: [{ name: "📖 Lezen", doneToday: true, daysThisWeek: 3 }] });
    expect(text).toContain("Eigen gewoontes");
    expect(text).toContain("📖 Lezen (vandaag gedaan, 3 van 7 dagen deze week)");
  });

  it("leaves the line out without habits", () => {
    expect(contextBlock(base)).not.toContain("Eigen gewoontes");
  });
});

describe("week score for the avatar ring", () => {
  it("adds daily points and capped trainings over Monday to Sunday", () => {
    const s = weekScore(
      "2026-11-02",
      [
        { checkin_date: "2026-11-02", activities: ["steps", "hydration", "run", "strength"] },
        { checkin_date: "2026-11-03", activities: ["steps", "nutrition", "protein", "recovery", "alcohol", "hydration", "run"] },
        { checkin_date: "2026-11-04", activities: ["run"] },
        { checkin_date: "2026-11-05", activities: ["run"] },
        { checkin_date: "2026-11-09", activities: ["steps"] },
      ],
      ["2026-11-04"],
    );
    // daily: 2 + 6 + joker 1 = 9; run 4 capped to 3; strength 1
    expect(s).toEqual({ earned: 13, total: 48, fraction: 13 / 48 });
  });

  it("is empty at the start of the week and never above full", () => {
    expect(weekScore("2026-11-02", []).fraction).toBe(0);
    const all = Array.from({ length: 7 }, (_, i) => ({ checkin_date: `2026-11-0${2 + i}`, activities: ["steps", "hydration", "nutrition", "protein", "recovery", "alcohol", "run", "strength"] }));
    expect(weekScore("2026-11-02", all)).toEqual({ earned: 48, total: 48, fraction: 1 });
  });
});
