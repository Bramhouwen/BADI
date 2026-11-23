import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { daypart, welcomeMessage, type WelcomeFacts } from "@/lib/welcome";

const base: WelcomeFacts = {
  name: "Anne",
  userId: "u-anne",
  date: "2026-11-24",
  hour: 8,
  weekday: 1,
  checkedInToday: false,
  yesterdayComplete: false,
  streak: 0,
  weekSteps: 20_000,
  stepsGoal: 70_000,
  run: { done: 1, target: 3 },
  strength: { done: 0, target: 3 },
  waterMl: 0,
  waterGoalMl: 2500,
  superBadi: false,
  canSpin: false,
  openChallenge: null,
  unreadFrom: [],
  finaleIn: 30,
};

describe("welcome message", () => {
  it("greets by name and time of day", () => {
    expect(daypart(8)).toBe("morning");
    expect(daypart(14)).toBe("afternoon");
    expect(daypart(20)).toBe("evening");
    expect(daypart(2)).toBe("night");
    expect(welcomeMessage(base).greeting).toContain("Anne");
  });

  it("is the same all day and differs from yesterday", () => {
    expect(welcomeMessage(base)).toEqual(welcomeMessage(base));
    for (let i = 0; i < 20; i++) {
      const day = addDays("2026-11-24", i);
      const next = addDays(day, 1);
      const a = welcomeMessage({ ...base, date: day });
      const b = welcomeMessage({ ...base, date: next });
      expect(a.greeting === b.greeting && a.line === b.line).toBe(false);
    }
  });

  it("puts unread messages first", () => {
    const m = welcomeMessage({ ...base, unreadFrom: [{ id: "u-bram", name: "Bram" }], superBadi: true, canSpin: true });
    expect(m.line).toContain("Bram");
    expect(m.anim).toBe("wave");
    expect(m.action?.href).toBe("/squad/chat/u-bram");
  });

  it("names two senders together", () => {
    expect(welcomeMessage({ ...base, unreadFrom: [{ id: "u-bram", name: "Bram" }, { id: "u-irene", name: "Irene" }] }).line).toContain("Bram en Irene");
  });

  it("uses real numbers for steps", () => {
    const only = { ...base, run: { done: 3, target: 3 }, strength: { done: 3, target: 3 } };
    const m = welcomeMessage(only);
    expect(m.line).toMatch(/50\.000|20\.000/);
    expect(m.anim).toBe("walk");
  });

  it("reminds you of the check-in in the evening", () => {
    const m = welcomeMessage({ ...base, hour: 20, run: { done: 3, target: 3 }, strength: { done: 3, target: 3 }, weekSteps: 80_000 });
    expect(m.action?.href).toBe("/checkin");
  });

  it("sits down at night", () => {
    expect(welcomeMessage({ ...base, hour: 1 }).anim).toBe("sit");
  });

  it("has a line when there is nothing to say", () => {
    const m = welcomeMessage({ ...base, weekday: 0, weekSteps: 0, run: { done: 3, target: 3 }, strength: { done: 3, target: 3 } });
    expect(m.line.length).toBeGreaterThan(10);
  });
});
