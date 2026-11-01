import { describe, expect, it } from "vitest";
import {
  addDays,
  challengeDay,
  challengePhase,
  dateKeyInTz,
  daysUntilFinale,
  diffDays,
  editableDates,
  greeting,
  isEditableDate,
  isValidDateKey,
  relativeTimeNl,
  wrappedStatus,
} from "@/lib/dates";

const challenge = { start_date: "2026-11-01", end_date: "2026-12-31", timezone: "Europe/Amsterdam" };

describe("timezone boundaries", () => {
  it("uses Europe/Amsterdam for the calendar day, not UTC", () => {
    // 23:30 UTC on 1 Nov = 00:30 Amsterdam on 2 Nov (CET, UTC+1)
    expect(dateKeyInTz(new Date("2026-11-01T23:30:00Z"))).toBe("2026-11-02");
    // 22:30 UTC on 1 Nov = 23:30 Amsterdam on 1 Nov
    expect(dateKeyInTz(new Date("2026-11-01T22:30:00Z"))).toBe("2026-11-01");
  });

  it("handles the DST change at the end of October", () => {
    // 25 Oct 2026 01:00 UTC: still CEST (UTC+2) = 03:00 local? DST ends 25 Oct 2026 at 01:00 UTC.
    expect(dateKeyInTz(new Date("2026-10-24T22:30:00Z"))).toBe("2026-10-25");
    expect(dateKeyInTz(new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-26");
  });

  it("validates date keys", () => {
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("2028-02-29")).toBe(true);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("nope")).toBe(false);
  });

  it("adds and diffs days across month boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(diffDays("2026-11-01", "2026-12-31")).toBe(60);
  });
});

describe("challenge start and end dates", () => {
  it("knows the phase", () => {
    expect(challengePhase(challenge, new Date("2026-10-31T12:00:00Z"))).toBe("before");
    expect(challengePhase(challenge, new Date("2026-11-01T12:00:00Z"))).toBe("during");
    expect(challengePhase(challenge, new Date("2026-12-31T12:00:00Z"))).toBe("during");
    expect(challengePhase(challenge, new Date("2027-01-01T12:00:00Z"))).toBe("after");
  });

  it("counts challenge days from one", () => {
    expect(challengeDay(challenge, new Date("2026-11-01T12:00:00Z"))).toBe(1);
    expect(challengeDay(challenge, new Date("2026-12-31T12:00:00Z"))).toBe(61);
    expect(challengeDay(challenge, new Date("2026-10-01T12:00:00Z"))).toBe(0);
  });

  it("counts down to the finale", () => {
    expect(daysUntilFinale(challenge, new Date("2026-11-01T12:00:00Z"))).toBe(60);
    expect(daysUntilFinale(challenge, new Date("2026-12-31T12:00:00Z"))).toBe(0);
  });

  it("flips the day at midnight Amsterdam time, not UTC", () => {
    // 1 Dec 00:30 Amsterdam is 30 Nov 23:30 UTC
    expect(challengeDay(challenge, new Date("2026-11-30T23:30:00Z"))).toBe(31);
  });
});

describe("yesterday's correction window", () => {
  it("allows today and yesterday during the challenge", () => {
    expect(editableDates(challenge, new Date("2026-11-10T12:00:00Z"))).toEqual(["2026-11-10", "2026-11-09"]);
  });

  it("allows only the first day on the first day", () => {
    expect(editableDates(challenge, new Date("2026-11-01T12:00:00Z"))).toEqual(["2026-11-01"]);
  });

  it("keeps the last day editable until 23:59 on 1 January", () => {
    expect(editableDates(challenge, new Date("2027-01-01T22:59:00Z"))).toEqual(["2026-12-31"]);
    expect(editableDates(challenge, new Date("2027-01-01T23:00:00Z"))).toEqual([]);
  });

  it("refuses dates outside the window", () => {
    expect(isEditableDate(challenge, "2026-11-08", new Date("2026-11-10T12:00:00Z"))).toBe(false);
    expect(isEditableDate(challenge, "2026-11-11", new Date("2026-11-10T12:00:00Z"))).toBe(false);
    expect(isEditableDate(challenge, "2026-10-31", new Date("2026-11-01T12:00:00Z"))).toBe(false);
  });

  it("does not allow challenge days outside the period", () => {
    expect(editableDates(challenge, new Date("2027-01-05T12:00:00Z"))).toEqual([]);
    expect(editableDates(challenge, new Date("2026-10-30T12:00:00Z"))).toEqual([]);
  });
});

describe("wrapped status", () => {
  it("is preliminary on the last day and during the correction window, final afterwards", () => {
    expect(wrappedStatus(challenge, new Date("2026-12-30T12:00:00Z"))).toBe("not_yet");
    expect(wrappedStatus(challenge, new Date("2026-12-31T12:00:00Z"))).toBe("preliminary");
    expect(wrappedStatus(challenge, new Date("2027-01-01T12:00:00Z"))).toBe("preliminary");
    expect(wrappedStatus(challenge, new Date("2027-01-02T12:00:00Z"))).toBe("final");
  });
});

describe("copy helpers", () => {
  it("greets by Amsterdam time", () => {
    expect(greeting(new Date("2026-11-01T08:00:00Z"))).toBe("Goedemorgen!");
    expect(greeting(new Date("2026-11-01T13:00:00Z"))).toBe("Goedemiddag!");
    expect(greeting(new Date("2026-11-01T19:00:00Z"))).toBe("Goedenavond!");
  });

  it("formats relative times in Dutch", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(relativeTimeNl("2026-11-10T11:59:40Z", now)).toBe("zojuist");
    expect(relativeTimeNl("2026-11-10T11:30:00Z", now)).toBe("30 min geleden");
    expect(relativeTimeNl("2026-11-09T12:00:00Z", now)).toBe("gisteren");
  });
});
