import { describe, expect, it } from "vitest";
import { dailyMessage, dailyVars, pickIndex, slotFromHour, type DailyInput } from "@/lib/coach/daily";

const base: DailyInput = {
  userId: "u-daphne",
  firstName: "Daphne",
  today: "2026-11-02",
  startDate: "2026-11-01",
  endDate: "2026-12-31",
  checkinDates: ["2026-11-01"],
  todayActivities: [],
  jokerToday: false,
  plannedToday: [],
};

describe("Baddy's daily messages", () => {
  it("knows the day, length, streak and score", () => {
    const v = dailyVars({ ...base, checkinDates: ["2026-11-01", "2026-11-02"], todayActivities: ["steps", "hydration", "run"] });
    expect(v).toMatchObject({ name: "Daphne", day: 2, length: 61, streak: 2, done: 2, total: 6, left: 4 });
  });

  it("writes a morning message with name and day, and mentions planned training", () => {
    const m = dailyMessage({ ...base, plannedToday: ["run", "strength"] }, "morning");
    expect(m.title).toBe("Baddy ☀️");
    expect(m.body).toContain("Daphne");
    expect(m.body).toContain("Op de planning: hardlopen en krachttraining.");
    expect(m.body).not.toMatch(/—/);
  });

  it("writes an evening message", () => {
    const m = dailyMessage({ ...base, todayActivities: ["steps"] }, "evening");
    expect(m.title).toBe("Baddy 🌙");
    expect(m.body).toContain("Daphne");
  });

  it("rotates: consecutive days differ and members differ on the same day", () => {
    const n = 12;
    expect(pickIndex("u1", 5, "morning", n)).not.toBe(pickIndex("u1", 6, "morning", n));
    const texts = new Set(["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"].map((today) => dailyMessage({ ...base, today }, "morning").body));
    expect(texts.size).toBe(5);
    const members = new Set(["u1", "u2", "u3", "u4"].map((userId) => pickIndex(userId, 10, "evening", 10)));
    expect(members.size).toBeGreaterThan(1);
  });

  it("only uses score lines that fit the day", () => {
    for (const today of ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]) {
      const none = dailyMessage({ ...base, today, checkinDates: [] }, "evening").body;
      expect(none).not.toMatch(/0 van 6 punten\. Trots/);
      expect(none).not.toMatch(/dagen op rij/);
      const all = dailyMessage({ ...base, today, todayActivities: ["steps", "hydration", "nutrition", "protein", "recovery", "alcohol"] }, "evening").body;
      expect(all).not.toMatch(/nog \d te gaan/);
    }
  });

  it("only sends at 07:00 and 21:00", () => {
    expect(slotFromHour(7)).toBe("morning");
    expect(slotFromHour(21)).toBe("evening");
    expect(slotFromHour(6)).toBeNull();
    expect(slotFromHour(20)).toBeNull();
  });
});
