import { describe, expect, it } from "vitest";
import { createDemoClient } from "@/lib/demo/mock-client";
import { parseMemberStats } from "@/lib/squad-stats";

const SAM = "00000000-0000-4000-8000-000000000002";
const ALEX = "00000000-0000-4000-8000-000000000003";
const NOOR = "00000000-0000-4000-8000-000000000004";
const ME = "00000000-0000-4000-8000-000000000001";
const STRANGER = "00000000-0000-4000-8000-000000000099";

/** The demo client mirrors the SQL function squad_member_stats, so its gating is testable here. */
describe("squad_member_stats gating (demo twin of the SQL function)", () => {
  const client = createDemoClient();
  const call = async (id: string) => client.rpc("squad_member_stats", { p_user: id });

  it("refuses users outside the squad", async () => {
    const r = await call(STRANGER);
    expect(r.error?.message).toBe("NOT_A_MEMBER");
  });

  it("returns everything for the caller's own profile", async () => {
    const p = parseMemberStats((await call(ME)).data);
    expect(p?.sharing).toEqual({ workout_counts: true, minutes_distance: true, active_days: true, checkins: true, records: true, recent_workouts: true });
    expect(p?.sessions.length).toBeGreaterThan(0);
    expect(p?.records?.strength.length).toBeGreaterThan(0);
  });

  it("keeps fitness data private by default and check-ins visible", async () => {
    const p = parseMemberStats((await call(ALEX)).data);
    expect(p?.sharing.workout_counts).toBe(false);
    expect(p?.sharing.checkins).toBe(true);
    expect(p?.sessions).toEqual([]);
    expect(p?.records).toBeNull();
    expect(p?.recent).toEqual([]);
    expect(p?.checkin_dates.length).toBeGreaterThan(0);
  });

  it("strips duration and distance when minutes are not shared, even in recent workouts", async () => {
    const p = parseMemberStats((await call(NOOR)).data);
    expect(p?.sharing.minutes_distance).toBe(false);
    expect(p?.sessions.length).toBeGreaterThan(0);
    expect(p?.sessions.every((s) => s.duration_seconds === null && s.distance_meters === null)).toBe(true);
    expect(p?.recent.every((s) => s.duration_seconds === null && s.distance_meters === null)).toBe(true);
    expect(p?.records).toBeNull();
  });

  it("gives full figures for a member who shares everything, without titles, notes or sets", async () => {
    const raw = (await call(SAM)).data as Record<string, unknown>;
    const p = parseMemberStats(raw);
    expect(p?.sessions.some((s) => s.duration_seconds && s.distance_meters)).toBe(true);
    expect(p?.records?.longest_run_meters).toBe(10500);
    expect(JSON.stringify(raw)).not.toMatch(/title|notes|weight_kg"?:\s*\d+,\s*"repetitions/);
  });
});
