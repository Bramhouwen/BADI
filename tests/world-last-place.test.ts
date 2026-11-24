import { describe, expect, it } from "vitest";
import { lastPlaceOf } from "@/lib/world/last-place";
import { SCENES } from "@/lib/world/scenes";

describe("waar iemand blijft staan na het weggaan", () => {
  const home = SCENES.huis;
  it("op de stoel waar die ging zitten", () => {
    const seat = home.seats[0];
    expect(lastPlaceOf({ scene: "huis", from: [0, 0], intent: { kind: "seat", id: seat.id } })).toEqual({ scene: "huis", x: seat.hip[0], y: seat.hip[1], activity: seat.id });
  });
  it("waar die naartoe liep", () => {
    expect(lastPlaceOf({ scene: "buiten", from: [1, 1], intent: { kind: "stand", to: [900, 520] } })).toEqual({ scene: "buiten", x: 900, y: 520, activity: null });
  });
  it("bij een plek zoals de loopband", () => {
    const spot = SCENES.sportschool.spots[0];
    expect(lastPlaceOf({ scene: "sportschool", from: [0, 0], intent: { kind: "spot", id: spot.id } })).toMatchObject({ scene: "sportschool", activity: spot.id });
  });
  it("niets bij een onbekende ruimte", () => {
    expect(lastPlaceOf({ scene: "weg", from: [0, 0], intent: { kind: "stand", to: [1, 1] } })).toBeNull();
  });
});
