import { describe, expect, it } from "vitest";
import { activityStatus, compareRows, deriveMemberStats, gridDays, parseMemberStats, sharingFromRow, sharingToRow, DEFAULT_SHARING, type MemberStatsPayload } from "@/lib/squad-stats";

const challenge = { start_date: "2026-11-01", end_date: "2026-12-31" };
const today = "2026-11-12"; // Thursday; week runs 9 to 15 Nov

const full: MemberStatsPayload = {
  user_id: "u1",
  sharing: { workout_counts: true, minutes_distance: true, active_days: true, checkins: true, records: true, recent_workouts: true, habits: true },
  sessions: [
    { activity_type: "run", workout_date: "2026-11-12", duration_seconds: 1500, distance_meters: 5000 },
    { activity_type: "strength", workout_date: "2026-11-12", duration_seconds: 3000, distance_meters: null },
    { activity_type: "walk", workout_date: "2026-11-10", duration_seconds: 2400, distance_meters: 4000 },
    { activity_type: "run", workout_date: "2026-11-03", duration_seconds: 3600, distance_meters: 10000 },
    { activity_type: "cycle", workout_date: "2026-10-28", duration_seconds: 3600, distance_meters: 30000 },
  ],
  workout_dates: [],
  checkin_dates: ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-10", "2026-11-11", "2026-11-12", "2026-10-30"],
  records: { longest_run_meters: 10000, fastest_5k_seconds: 1500, strength: [{ exercise: "Squat", max_weight_kg: 80 }] },
  recent: [{ activity_type: "run", workout_date: "2026-11-12", duration_seconds: 1500, distance_meters: 5000 }],
};

describe("deriveMemberStats", () => {
  it("counts workouts per Monday-based week, calendar month and in total", () => {
    const s = deriveMemberStats(full, today, challenge);
    expect(s.workouts).toEqual({ week: 3, month: 4, total: 5 });
  });

  it("sums minutes and only run/walk distance for the month", () => {
    const s = deriveMemberStats(full, today, challenge);
    expect(s.effort?.minutesWeek).toBe(Math.round((1500 + 3000 + 2400) / 60));
    expect(s.effort?.minutesMonth).toBe(Math.round((1500 + 3000 + 2400 + 3600) / 60));
    expect(s.effort?.distanceMonthMeters).toBe(5000 + 4000 + 10000); // the bike ride is excluded
  });

  it("counts a day with two workouts once", () => {
    const s = deriveMemberStats(full, today, challenge);
    expect(s.activeDays).toEqual({ week: 2, month: 3, total: 4 });
  });

  it("derives check-in consistency over elapsed challenge days and ignores check-ins outside the challenge", () => {
    const s = deriveMemberStats(full, today, challenge);
    expect(s.checkin?.daysElapsed).toBe(12);
    expect(s.checkin?.total).toBe(6);
    expect(s.checkin?.consistencyPct).toBe(50);
    expect(s.checkin?.current).toBe(3);
    expect(s.checkin?.longest).toBe(3);
  });

  it("hides categories that are not shared", () => {
    const p: MemberStatsPayload = { ...full, sharing: { ...full.sharing, workout_counts: false, minutes_distance: false, records: false }, sessions: [], workout_dates: ["2026-11-12", "2026-11-10"], records: null };
    const s = deriveMemberStats(p, today, challenge);
    expect(s.workouts).toBeNull();
    expect(s.effort).toBeNull();
    expect(s.records).toBeNull();
    expect(s.activeDays).toEqual({ week: 2, month: 2, total: 2 });
  });

  it("needs both counts and minutes for effort figures", () => {
    const p: MemberStatsPayload = { ...full, sharing: { ...full.sharing, minutes_distance: false }, sessions: full.sessions.map((x) => ({ ...x, duration_seconds: null, distance_meters: null })) };
    expect(deriveMemberStats(p, today, challenge).effort).toBeNull();
  });
});

describe("parseMemberStats", () => {
  it("never trusts data for a category the server marked as not shared", () => {
    const parsed = parseMemberStats({ user_id: "u", sharing: { workout_counts: false, checkins: false }, sessions: [{ activity_type: "run", workout_date: "2026-11-12" }], checkin_dates: ["2026-11-12"], records: { strength: [] }, recent: [] });
    expect(parsed?.sessions).toEqual([]);
    expect(parsed?.checkin_dates).toEqual([]);
    expect(parsed?.records).toBeNull();
  });

  it("returns null for garbage", () => {
    expect(parseMemberStats(null)).toBeNull();
    expect(parseMemberStats("x")).toBeNull();
  });
});

describe("activity status and grid", () => {
  it("prefers today's check-in, then today's workout, then recency", () => {
    const s = deriveMemberStats(full, today, challenge);
    expect(activityStatus(s, today)).toBe("Vandaag ingecheckt");
    const noToday = deriveMemberStats({ ...full, checkin_dates: ["2026-11-10"], sessions: [full.sessions[2]], recent: [] }, today, challenge);
    expect(activityStatus(noToday, today)).toBe("2 dagen geleden actief");
    const nothing = deriveMemberStats({ ...full, checkin_dates: [], sessions: [], recent: [] }, today, challenge);
    expect(activityStatus(nothing, today)).toBeNull();
  });

  it("builds week, previous week and month grids", () => {
    const s = deriveMemberStats(full, today, challenge);
    const week = gridDays(s, today, "week");
    expect(week.map((d) => d.date)[0]).toBe("2026-11-09");
    expect(week.find((d) => d.date === "2026-11-12")).toMatchObject({ workout: true, checkin: true, isToday: true });
    expect(week.filter((d) => d.future)).toHaveLength(3);
    expect(gridDays(s, today, "prev-week")[0].date).toBe("2026-11-02");
    const month = gridDays(s, today, "month");
    expect(month).toHaveLength(30);
    expect(month[0].date).toBe("2026-11-01");
  });
});

describe("comparison and settings", () => {
  it("only compares what the other member shares", () => {
    const mine = deriveMemberStats(full, today, challenge);
    const theirs = deriveMemberStats({ ...full, sharing: { ...full.sharing, minutes_distance: false, checkins: false }, checkin_dates: [] }, today, challenge);
    const rows = compareRows(mine, theirs);
    expect(rows.map((r) => r.key)).toEqual(["workouts_week", "active_month"]);
  });

  it("maps settings rows both ways with private fitness defaults", () => {
    expect(sharingFromRow(null)).toEqual(DEFAULT_SHARING);
    expect(DEFAULT_SHARING.checkins).toBe(true);
    expect(DEFAULT_SHARING.records).toBe(false);
    const row = sharingToRow({ ...DEFAULT_SHARING, records: true });
    expect(row.share_records).toBe(true);
    expect(sharingFromRow(row)).toEqual({ ...DEFAULT_SHARING, records: true });
  });
});
