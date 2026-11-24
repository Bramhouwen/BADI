import { describe, expect, it } from "vitest";
import { HOME_SCENE, hasNoPlace, seatNewcomers } from "@/lib/world/newcomers";
import { SCENES } from "@/lib/world/scenes";

const none = { scene: null, x: null, y: null, activity: null };

describe("wie nog niet in de wereld was", () => {
  it("heeft geen plek zonder profiel, scene of positie", () => {
    expect(hasNoPlace(null)).toBe(true);
    expect(hasNoPlace(none)).toBe(true);
    expect(hasNoPlace({ scene: "buiten", x: null, y: null, activity: null })).toBe(true);
    expect(hasNoPlace({ scene: "bestaat-niet", x: 1, y: 1, activity: null })).toBe(true);
    expect(hasNoPlace({ scene: "buiten", x: 900, y: 520, activity: null })).toBe(false);
  });

  it("zit op een vrije plek op de bank in de woonkamer, nooit op een bezette", () => {
    const seats = SCENES[HOME_SCENE].seats.map((s) => s.id);
    const out = seatNewcomers([{ id: "a", ...none }, { id: "b", ...none }, { id: "c", scene: "buiten", x: 900, y: 520, activity: null }], [seats[0]]);
    expect(out[0]).toMatchObject({ scene: HOME_SCENE, activity: seats[1] });
    expect(out[1]).toMatchObject({ scene: HOME_SCENE, activity: seats[2] });
    expect(out[2]).toMatchObject({ scene: "buiten", x: 900 });
    const seat = SCENES[HOME_SCENE].seats[1];
    expect([out[0].x, out[0].y]).toEqual(seat.hip);
  });

  it("staat voor de bank als alle plekken bezet zijn", () => {
    const seats = SCENES[HOME_SCENE].seats.map((s) => s.id);
    const [out] = seatNewcomers([{ id: "a", ...none }], seats);
    expect(out.scene).toBe(HOME_SCENE);
    expect(out.activity).toBeNull();
    expect(out.x).not.toBeNull();
  });
});
