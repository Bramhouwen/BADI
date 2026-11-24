import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { ITEMS, ITEM_BY_ID } from "@/lib/world/items";
import { buildGrid } from "@/lib/world/engine/grid";
import { coveredTiles, depthOf, fits, footprint, freeSpot, seatHip, type Placement } from "@/lib/world/engine/furniture";
import { SCENES } from "@/lib/world/scenes";
import { ROOMS, ROOM_COLOURS, roomId } from "@/lib/world/scenes/kamers";

const room = SCENES[roomId("bram")];
const grid = buildGrid(room);
const piece = (id: string, itemId: string, u: number, v: number, flip = false): Placement => ({ id, item: ITEM_BY_ID.get(itemId)!, u, v, flip });

describe("own rooms", () => {
  it("has a room for every character, each with its own picture", () => {
    expect(ROOMS.map((r) => r.owner).sort()).toEqual(Object.keys(ROOM_COLOURS).sort());
    for (const r of ROOMS) expect(fs.existsSync(`public${r.background}`)).toBe(true);
  });
  it("has a picture for every piece in the shop", () => {
    for (const i of ITEMS) expect(fs.existsSync(`public/wereld/meubels/${i.id}.webp`), i.id).toBe(true);
  });
  it("asks the same prices as the database (migrations 0032 and 0034)", () => {
    const sql = ["supabase/migrations/0032_world_rooms.sql", "supabase/migrations/0034_world_space_items.sql"].map((f) => fs.readFileSync(f, "utf8")).join("\n");
    const prices = Object.fromEntries([...sql.matchAll(/\('([a-z0-9-]+)', (\d+)\)/g)].map((m) => [m[1], Number(m[2])]));
    expect(Object.keys(prices).sort()).toEqual(ITEMS.map((i) => i.id).sort());
    for (const i of ITEMS) expect(prices[i.id], i.id).toBe(i.price);
  });
  it("turns a piece a quarter: its footprint swaps", () => {
    expect(footprint(piece("a", "bank", 0, 0))).toEqual([4, 2]);
    expect(footprint(piece("a", "bank", 0, 0, true))).toEqual([2, 4]);
    expect(coveredTiles(piece("a", "bed", 2, 3))).toHaveLength(12);
  });
  it("only places furniture on free floor, never on top of other furniture", () => {
    const sofa = piece("a", "bank", 4, 4);
    expect(fits(grid, sofa, [])).toBe(true);
    expect(fits(grid, piece("b", "fauteuil", 5, 4), [sofa])).toBe(false);
    expect(fits(grid, piece("b", "fauteuil", 9, 9), [sofa])).toBe(true);
    expect(fits(grid, piece("c", "bank", 11, 11), [])).toBe(false);
  });
  it("lets a rug lie under furniture", () => {
    const sofa = piece("a", "bank", 4, 4);
    expect(fits(grid, piece("r", "kleed-rond", 4, 4), [sofa])).toBe(true);
  });
  it("finds a free spot for something new, until the room is full", () => {
    const placed: Placement[] = [];
    for (let i = 0; i < 40; i++) {
      const p = piece(`p${i}`, "bed", 0, 0);
      const spot = freeSpot(grid, p, placed);
      if (!spot) break;
      placed.push({ ...p, ...spot });
    }
    expect(placed.length).toBeGreaterThan(2);
    for (const p of placed) expect(fits(grid, p, placed)).toBe(true);
  });
  it("draws furniture further forward over what stands behind it", () => {
    expect(depthOf(grid, piece("a", "bank", 6, 6))).toBeGreaterThan(depthOf(grid, piece("b", "bank", 2, 2)));
  });
  it("gives a seat on a sofa, none on a bookcase", () => {
    expect(seatHip(grid, piece("a", "bank", 4, 4))).not.toBeNull();
    expect(seatHip(grid, piece("a", "boekenkast", 4, 4))).toBeNull();
  });
});
