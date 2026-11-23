import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { buddyBrief, joinNl, type BuddyFacts } from "@/lib/welcome";

const base: BuddyFacts = {
  userId: "u-anne",
  date: "2026-11-24",
  hour: 9,
  weekday: 1,
  yesterdayComplete: false,
  streak: 0,
  weekSteps: 20_000,
  stepsGoal: 70_000,
  lastWorkoutDate: null,
  superBadi: false,
  canSpin: false,
  unreadFrom: [],
  complimentsUnread: 0,
  squadNew: null,
  squadCompleteYesterday: [],
  squadWeekSteps: 0,
  finaleIn: 30,
};

const texts = (f: BuddyFacts) => buddyBrief(f).items.map((i) => i.text).join(" | ");

describe("buddy brief", () => {
  it("never reminds you of what you still have to do", () => {
    const all = texts({ ...base, weekSteps: 10_000, canSpin: true, weekday: 3, hour: 21 });
    expect(all).not.toMatch(/nog \d|te gaan|staat nog open|vergeet/i);
    expect(buddyBrief({ ...base, canSpin: true, weekday: 3 }).items).toHaveLength(0);
  });

  it("brings news first, with a link to it", () => {
    const b = buddyBrief({ ...base, unreadFrom: [{ id: "u-bram", name: "Bram" }], complimentsUnread: 2, yesterdayComplete: true, squadWeekSteps: 90_000 });
    expect(b.items.map((i) => i.kind)).toEqual(["news", "news", "win"]);
    expect(b.items[0]).toMatchObject({ text: "Bram stuurde je een bericht.", href: "/squad/chat/u-bram" });
    expect(b.items[1].text).toBe("Je hebt 2 nieuwe complimenten.");
    expect(b.anim).toBe("wave");
  });

  it("shows at most three lines", () => {
    const b = buddyBrief({
      ...base,
      unreadFrom: [{ id: "a", name: "Sam" }, { id: "b", name: "Noor" }],
      complimentsUnread: 1,
      superBadi: true,
      weekday: 0,
      yesterdayComplete: true,
      squadCompleteYesterday: ["Daphne"],
    });
    expect(b.items.length).toBeLessThanOrEqual(3);
    expect(b.items[0].text).toBe("Sam en Noor stuurden je een bericht.");
  });

  it("mentions Super Badi and a new spin only on Monday", () => {
    expect(texts({ ...base, weekday: 0, superBadi: true, canSpin: true })).toContain("Super Badi");
    expect(texts({ ...base, weekday: 0, superBadi: true, canSpin: true })).toContain("Weekrad");
    expect(texts({ ...base, weekday: 2, superBadi: true, canSpin: true })).toBe("");
    expect(buddyBrief({ ...base, weekday: 0, superBadi: true }).anim).toBe("cheer");
  });

  it("celebrates what you achieved", () => {
    expect(texts({ ...base, streak: 14 })).toBe("14 dagen op rij ingecheckt!");
    expect(texts({ ...base, weekSteps: 71_000 })).toContain("70.000 stappen is binnen");
    expect(texts({ ...base, lastWorkoutDate: "2026-11-23" })).toContain("training van gisteren");
    expect(buddyBrief({ ...base, yesterdayComplete: true }).anim).toBe("happy");
  });

  it("tells how the squad is doing", () => {
    expect(texts({ ...base, squadCompleteYesterday: ["Daphne", "Irene"] })).toBe("Daphne en Irene hadden gisteren alles afgevinkt.");
    expect(texts({ ...base, squadWeekSteps: 210_000 })).toBe("Samen al 210.000 stappen deze week.");
  });

  it("varies from day to day but not within a day", () => {
    const f = { ...base, yesterdayComplete: true, weekSteps: 80_000, streak: 4 };
    expect(buddyBrief(f)).toEqual(buddyBrief(f));
    for (let i = 0; i < 10; i++) {
      const day = addDays("2026-11-24", i);
      const a = texts({ ...f, date: day, streak: 4 });
      const b = texts({ ...f, date: addDays(day, 1), streak: 4 });
      expect(a).not.toBe(b);
    }
  });

  it("sits down at night", () => {
    expect(buddyBrief({ ...base, hour: 2, yesterdayComplete: true }).anim).toBe("sit");
  });

  it("joins names in Dutch", () => {
    expect(joinNl(["Sam"])).toBe("Sam");
    expect(joinNl(["Sam", "Noor", "Alex"])).toBe("Sam, Noor en Alex");
  });
});
