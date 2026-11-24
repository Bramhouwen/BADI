import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { SPACES, isRoomArea, spaceItem } from "@/lib/world/spaces";
import { SCENES } from "@/lib/world/scenes";
import { ROOM_COLOURS, roomId, spaceSceneId } from "@/lib/world/scenes/kamers";
import { SUPER_BADI_COINS } from "@/lib/super-badi";
import { placeOf } from "@/components/world/world-of-badi-card";

const sql = fs.readFileSync("supabase/migrations/0033_world_spaces.sql", "utf8");

describe("extra spaces", () => {
  it("asks the same prices as the database (migration 0033)", () => {
    const prices = Object.fromEntries([...sql.matchAll(/\('(ruimte-[a-z]+)', (\d+)\)/g)].map((m) => [m[1], Number(m[2])]));
    expect(Object.keys(prices).sort()).toEqual(SPACES.map((s) => spaceItem(s.id)).sort());
    for (const s of SPACES) expect(prices[spaceItem(s.id)], s.id).toBe(s.price);
  });

  it("gives 500 coins per Super Badi win, in the app and in the database", () => {
    expect(SUPER_BADI_COINS).toBe(500);
    expect(sql).toMatch(/select 500 from public\.super_badi_awards/);
  });

  it("has every space for every room, with a picture and a door back into the room", () => {
    for (const c of Object.keys(ROOM_COLOURS)) {
      for (const s of SPACES) {
        const scene = SCENES[spaceSceneId(c, s.id)];
        expect(scene, `${c} ${s.id}`).toBeTruthy();
        expect(scene.owner).toBe(c);
        expect(scene.space).toBe(s.id);
        expect(fs.existsSync(`public${scene.background}`)).toBe(true);
        expect(scene.doors.map((d) => d.to)).toEqual([roomId(c)]);
        // The room's door is where you come back in.
        expect(SCENES[roomId(c)].doors.some((d) => d.id === scene.doors[0].arrive)).toBe(true);
        // On the map of the card: at home.
        expect(placeOf(scene.id)).toBe("huis");
      }
    }
  });

  it("knows where furniture may stand", () => {
    expect(isRoomArea("kamer")).toBe(true);
    expect(isRoomArea("tuin")).toBe(true);
    expect(isRoomArea("kelder")).toBe(false);
  });
});
