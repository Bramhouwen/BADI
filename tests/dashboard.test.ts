import { describe, expect, it } from "vitest";
import { consistency, daysOnWaterGoal, delta, heatmap, pointsByDate, trainingWeeks, waterDays, weekDays, weekScoreSeries } from "@/lib/dashboard";

const checkins = [
  { checkin_date: "2026-11-02", activities: ["steps", "hydration", "run"] },
  { checkin_date: "2026-11-03", activities: ["steps", "hydration", "nutrition", "protein", "recovery", "alcohol"] },
  { checkin_date: "2026-11-09", activities: ["steps"] },
];

describe("dashboard points", () => {
  it("counts daily points and a joker as no alcohol", () => {
    const p = pointsByDate(checkins, ["2026-11-04"]);
    expect(p.get("2026-11-02")).toBe(2);
    expect(p.get("2026-11-03")).toBe(6);
    expect(p.get("2026-11-04")).toBe(1);
    expect(weekDays("2026-11-02", p).map((d) => d.points)).toEqual([2, 6, 1, 0, 0, 0, 0]);
  });

  it("builds week scores oldest first", () => {
    const s = weekScoreSeries("2026-11-10", checkins, [], 2);
    expect(s.map((w) => w.start)).toEqual(["2026-11-02", "2026-11-09"]);
    expect(s[0].earned).toBe(2 + 6 + 1); // run counts toward the weekly target
    expect(s[1].earned).toBe(1);
  });

  it("lays out the challenge calendar in Monday weeks and hides the future", () => {
    const p = pointsByDate(checkins, []);
    const cols = heatmap("2026-11-01", "2026-11-10", "2026-11-03", p);
    expect(cols).toHaveLength(3); // week of 26 Oct (only Sunday 1 Nov), 2 Nov, 9 Nov
    expect(cols[0].slice(0, 6).every((c) => c === null)).toBe(true);
    expect(cols[0][6]).toEqual({ date: "2026-11-01", points: 0 });
    expect(cols[1][1]).toEqual({ date: "2026-11-03", points: 6 });
    expect(cols[1][2]).toEqual({ date: "2026-11-04", points: null });
    expect(cols[2][2]).toBeNull();
  });

  it("measures consistency over the days so far", () => {
    expect(consistency(pointsByDate(checkins, []), "2026-11-01", "2026-11-04")).toEqual({ days: 4, active: 2, pct: 50 });
  });
});

describe("dashboard water and training", () => {
  it("sums water per day and counts days on the goal", () => {
    const w = waterDays([{ log_date: "2026-11-02", amount_ml: 2000 }, { log_date: "2026-11-02", amount_ml: 600 }, { log_date: "2026-11-01", amount_ml: 500 }], "2026-11-02", 3);
    expect(w).toEqual([{ date: "2026-10-31", ml: 0 }, { date: "2026-11-01", ml: 500 }, { date: "2026-11-02", ml: 2600 }]);
    expect(daysOnWaterGoal(w)).toBe(1);
  });

  it("groups workouts per week with minutes and running km", () => {
    const s = (id: string, type: string, date: string, sec: number, m: number | null) => ({ id, activity_type: type, workout_date: date, duration_seconds: sec, distance_meters: m, status: "completed", title: id });
    const weeks = trainingWeeks([s("a", "run", "2026-11-02", 1800, 5200), s("b", "strength", "2026-11-03", 3600, null), s("c", "walk", "2026-11-04", 1200, 3000), s("d", "run", "2026-10-28", 1500, 4000)], "2026-11-05", 2);
    expect(weeks[1]).toEqual({ start: "2026-11-02", run: 1, strength: 1, other: 1, minutes: 110, runKm: 5.2 });
    expect(weeks[0]).toMatchObject({ start: "2026-10-26", run: 1, runKm: 4 });
  });

  it("gives a change against the previous period", () => {
    expect(delta(3, 1)).toBe(2);
    expect(delta(0, 0)).toBeNull();
  });
});
