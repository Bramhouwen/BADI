import { describe, expect, it } from "vitest";
import { computeStreakStats, isMilestone, recentCalendar } from "@/lib/streaks";

describe("streak calculations", () => {
  it("counts consecutive days ending today", () => {
    const s = computeStreakStats(["2026-11-01", "2026-11-02", "2026-11-03"], "2026-11-03");
    expect(s.current).toBe(3);
    expect(s.longest).toBe(3);
    expect(s.total).toBe(3);
    expect(s.checkedInToday).toBe(true);
    expect(s.lastDate).toBe("2026-11-03");
  });

  it("does not break the streak when today is not yet checked in", () => {
    const s = computeStreakStats(["2026-11-01", "2026-11-02"], "2026-11-03");
    expect(s.current).toBe(2);
    expect(s.checkedInToday).toBe(false);
    expect(s.checkedInYesterday).toBe(true);
  });

  it("resets the current streak after a missed day", () => {
    const s = computeStreakStats(["2026-11-01", "2026-11-02"], "2026-11-04");
    expect(s.current).toBe(0);
    expect(s.longest).toBe(2);
    expect(s.total).toBe(2);
  });

  it("finds the longest streak in history", () => {
    const s = computeStreakStats(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-05", "2026-11-06", "2026-11-10"], "2026-11-10");
    expect(s.longest).toBe(3);
    expect(s.current).toBe(1);
  });

  it("counts a day once even if dates repeat (duplicate prevention)", () => {
    const s = computeStreakStats(["2026-11-01", "2026-11-01", "2026-11-02"], "2026-11-02");
    expect(s.total).toBe(2);
    expect(s.current).toBe(2);
  });

  it("handles an empty history", () => {
    const s = computeStreakStats([], "2026-11-02");
    expect(s).toMatchObject({ current: 0, longest: 0, total: 0, lastDate: null });
  });

  it("continues a streak across the month boundary", () => {
    const s = computeStreakStats(["2026-11-29", "2026-11-30", "2026-12-01"], "2026-12-01");
    expect(s.current).toBe(3);
  });

  it("builds a seven day calendar ending today", () => {
    const cal = recentCalendar(["2026-11-05", "2026-11-07"], "2026-11-07", 7, { start_date: "2026-11-01", end_date: "2026-12-31" });
    expect(cal).toHaveLength(7);
    expect(cal[0].date).toBe("2026-11-01");
    expect(cal[6]).toMatchObject({ date: "2026-11-07", done: true, isToday: true });
    expect(cal[4]).toMatchObject({ date: "2026-11-05", done: true });
    expect(cal[5].done).toBe(false);
  });

  it("marks days before the challenge as outside", () => {
    const cal = recentCalendar([], "2026-11-02", 7, { start_date: "2026-11-01", end_date: "2026-12-31" });
    expect(cal[0].inChallenge).toBe(false);
    expect(cal[6].inChallenge).toBe(true);
  });

  it("knows milestones", () => {
    expect(isMilestone(7)).toBe(true);
    expect(isMilestone(8)).toBe(false);
  });
});
