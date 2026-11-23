import { describe, expect, it } from "vitest";
import { MISSION_COINS, STEPS_GOAL, coinsForDay, dayRecords, missionsFor } from "@/lib/world/missions";
import { readAction, readPresence } from "@/lib/world/engine/presence";
import { endAction, newAvatar, playAction } from "@/lib/world/engine/avatar";
import { WATER_GOAL_ML } from "@/lib/constants";

describe("missions and coins", () => {
  it("gives coins only for what was really done that day", () => {
    expect(coinsForDay({ checkin: false, training: false, waterMl: 0, steps: 0 })).toBe(0);
    expect(coinsForDay({ checkin: true, training: true, waterMl: WATER_GOAL_ML, steps: STEPS_GOAL })).toBe(MISSION_COINS.checkin + MISSION_COINS.training + MISSION_COINS.water + MISSION_COINS.steps);
    expect(coinsForDay({ checkin: true, training: false, waterMl: WATER_GOAL_ML - 1, steps: STEPS_GOAL - 1 })).toBe(MISSION_COINS.checkin);
  });
  it("adds up water over the day and keeps the highest step count", () => {
    const days = dayRecords({
      checkins: [{ checkin_date: "2026-11-23" }],
      workouts: [{ workout_date: "2026-11-22" }],
      water: [{ log_date: "2026-11-23", amount_ml: 1500 }, { log_date: "2026-11-23", amount_ml: 1000 }],
      steps: [{ log_date: "2026-11-23", steps: 8000 }, { log_date: "2026-11-23", steps: 11000 }],
    });
    expect(days.get("2026-11-23")).toEqual({ checkin: true, training: false, waterMl: 2500, steps: 11000 });
    expect(days.get("2026-11-22")?.training).toBe(true);
  });
  it("lists today's missions with progress and where to do them", () => {
    const m = missionsFor({ checkin: true, training: false, waterMl: 1250, steps: 3000 });
    expect(m.map((x) => x.key)).toEqual(["checkin", "training", "water", "steps"]);
    expect(m[0].done).toBe(true);
    expect(m[1]).toMatchObject({ done: false, href: "/fitness/start" });
    expect(m[2].progress).toBe("1.250 / 2.500 ml");
    expect(m[3].progress).toBe("3.000 / 10.000");
  });
});

describe("actions and status on the channel", () => {
  it("reads an action and ignores unknown ones", () => {
    expect(readAction({ from: "u1", scene: "woonkamer", kind: "highfive", to: "u2" })).toEqual({ from: "u1", scene: "woonkamer", kind: "highfive", to: "u2" });
    expect(readAction({ from: "u1", scene: "woonkamer", kind: "zwaai" })?.to).toBeNull();
    expect(readAction({ from: "u1", scene: "woonkamer", kind: "toString" })).toBeNull();
    expect(readAction({ from: "u1", scene: "../x", kind: "zwaai" })).toBeNull();
  });
  it("reads a status and a training glow, and drops strange values", () => {
    const base = { v: 1, name: "Anne", character: "anne", scene: "woonkamer", from: [400, 1000], intent: { kind: "stand", to: [500, 1000] }, at: 1 };
    expect(readPresence({ ...base, status: "trainen", trained: true })).toMatchObject({ status: "trainen", trained: true });
    expect(readPresence({ ...base, status: "hacken", trained: "ja" })).toMatchObject({ status: null, trained: false });
  });
  it("plays an action while standing, ends it after its time, and not while walking", () => {
    const a = newAvatar("a", "anne", "Anne", [0, 0], 0);
    expect(playAction(a, "zwaaien", 2, 0, "left")).toBe(true);
    expect(a.pose).toBe("zwaaien");
    expect(a.facing).toBe("left");
    endAction(a, 1000);
    expect(a.pose).toBe("zwaaien");
    endAction(a, 2000);
    expect(a.pose).toBe("staan");
    a.state = "walk";
    expect(playAction(a, "juichen", 2, 3000)).toBe(false);
  });
});
