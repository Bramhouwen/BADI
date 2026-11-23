import { describe, expect, it } from "vitest";
import { pointInPolygon, polylineYAt } from "@/lib/world/engine/geometry";
import { buildGrid } from "@/lib/world/engine/grid";
import { findPath, smoothPath } from "@/lib/world/engine/pathfinding";
import { backToFront, occludersOver } from "@/lib/world/engine/depth";
import { frameIndex } from "@/lib/world/engine/sprites";
import { newAvatar, sit, step, walk } from "@/lib/world/engine/avatar";
import { WOONKAMER } from "@/lib/world/scenes/woonkamer";
import { readSeats, seatAt, seatOccluder, sitOrigin } from "@/lib/world/engine/seats";

const grid = buildGrid(WOONKAMER);

describe("geometry", () => {
  it("knows inside from outside", () => {
    const sq = [[0, 0], [10, 0], [10, 10], [0, 10]] as const;
    expect(pointInPolygon([5, 5], sq)).toBe(true);
    expect(pointInPolygon([15, 5], sq)).toBe(false);
  });
  it("reads a front edge at any x and holds it flat beyond the ends", () => {
    const line = [[0, 100], [100, 200]] as const;
    expect(polylineYAt(line, 50)).toBe(150);
    expect(polylineYAt(line, -20)).toBe(100);
    expect(polylineYAt(line, 300)).toBe(200);
  });
});

describe("living room grid", () => {
  it("maps tiles to pixels and back", () => {
    const [u, v] = grid.pxToTile(grid.tileToPx(7.25, 11.5));
    expect(u).toBeCloseTo(7.25, 6);
    expect(v).toBeCloseTo(11.5, 6);
  });
  it("lets you stand on the open floor but not in furniture", () => {
    const free = grid.tileAt([700, 1100])!;
    expect(grid.isWalkable(...free)).toBe(true);
    const sofa = grid.tileAt([980, 560])!;
    expect(grid.isWalkable(...sofa)).toBe(false);
    const table = grid.tileAt([1300, 1100])!;
    expect(grid.isWalkable(...table)).toBe(false);
  });
  it("has the spawn, every seat approach and the door reachable from each other", () => {
    const start = grid.nearestWalkable(WOONKAMER.spawn)!;
    for (const p of [...WOONKAMER.seats.map((s) => s.approach), ...WOONKAMER.doors.map((d) => d.approach)]) {
      const t = grid.tileAt(p)!;
      expect(grid.isWalkable(...t), `${p}`).toBe(true);
      expect(findPath(grid, start, t), `${p}`).not.toBeNull();
    }
  });
});

describe("routes", () => {
  it("goes around the dining table and never through a blocked tile", () => {
    const from = grid.tileAt([1300, 900])!;
    const to = grid.nearestWalkable([1250, 1320])!;
    const path = findPath(grid, from, to)!;
    expect(path).not.toBeNull();
    for (const [u, v] of path) expect(grid.isWalkable(u, v)).toBe(true);
    // Diagonal steps never cut the corner of a blocked tile.
    for (let i = 1; i < path.length; i++) {
      const [u0, v0] = path[i - 1];
      const [u1, v1] = path[i];
      if (u0 !== u1 && v0 !== v1) {
        expect(grid.isWalkable(u1, v0)).toBe(true);
        expect(grid.isWalkable(u0, v1)).toBe(true);
      }
    }
    const smooth = smoothPath(grid, path);
    expect(smooth.length).toBeLessThanOrEqual(path.length);
    expect(smooth[0]).toEqual(path[0]);
    expect(smooth[smooth.length - 1]).toEqual(path[path.length - 1]);
  });
  it("finds no route into furniture", () => {
    expect(findPath(grid, grid.tileAt([700, 1100])!, grid.tileAt([980, 560])!)).toBeNull();
  });
});

describe("depth", () => {
  const box = (x: number, y: number) => ({ x: x - 100, y: y - 300, w: 200, h: 300 });
  it("draws the dining set over someone standing behind it", () => {
    const over = occludersOver([1300, 900], box(1300, 900), WOONKAMER.occluders);
    expect(over.map((o) => o.id)).toContain("eettafel");
  });
  it("draws nothing over someone in front of it", () => {
    const over = occludersOver([1250, 1310], box(1250, 1310), WOONKAMER.occluders);
    expect(over.map((o) => o.id)).not.toContain("eettafel");
  });
  it("leaves out the seat you sit on, but keeps the coffee table in front of your legs", () => {
    const seat = WOONKAMER.seats.find((s) => s.id === "zit-2")!;
    const over = occludersOver(seat.hip, box(seat.hip[0], seat.hip[1]), WOONKAMER.occluders, seatOccluder(WOONKAMER.occluders, seat)).map((o) => o.id);
    expect(over).not.toContain("sofa");
    expect(over).toContain("salontafel");
  });
  it("orders characters from back to front", () => {
    expect(backToFront([{ feet: [0, 900] as const }, { feet: [0, 700] as const }]).map((a) => a.feet[1])).toEqual([700, 900]);
  });
});

describe("characters", () => {
  it("never asks for a frame before the first", () => {
    expect(frameIndex(8, 6, -40)).toBe(0);
    expect(frameIndex(8, 6, 0)).toBe(0);
    expect(frameIndex(8, 6, 1000)).toBe(2);
    expect(frameIndex(1, 1, 5000)).toBe(0);
  });
  it("walks a route, faces the way it goes and stops", () => {
    const a = newAvatar("me", "anne", "Anne", [100, 100], 0);
    let arrived = false;
    walk(a, [[100, 100], [40, 100]], 0, () => (arrived = true));
    step(a, 0.1, 100);
    expect(a.state).toBe("walk");
    expect(a.facing).toBe("left");
    step(a, 1, 1100);
    expect(a.feet).toEqual([40, 100]);
    expect(a.state).toBe("idle");
    expect(arrived).toBe(true);
  });
  it("sits on a seat and stands up again by walking", () => {
    const a = newAvatar("me", "anne", "Anne", [800, 704], 0);
    sit(a, "bank-midden", [985, 642], "right", 0);
    expect(a.state).toBe("sit");
    walk(a, [[800, 704]], 10, null, "sofa");
    expect(a.seat).toBeNull();
    expect(a.ignore).toBe("sofa");
  });
});

describe("seats", () => {
  it("reads the placed seats and leaves out broken ones", () => {
    const seats = readSeats({ seats: [{ id: "a", hip: [1, 2], facing: "left", approach: [3, 4] }, { id: "b", hip: [1], facing: "left", approach: [3, 4] }, { id: "c", hip: [1, 2], facing: "up", approach: [3, 4] }] });
    expect(seats.map((s) => s.id)).toEqual(["a"]);
    expect(readSeats(null)).toEqual([]);
  });
  it("every seat in the living room sits on furniture and is reached over the floor", () => {
    const grid = buildGrid(WOONKAMER);
    expect(WOONKAMER.seats.length).toBeGreaterThan(0);
    for (const seat of WOONKAMER.seats) {
      expect(seatOccluder(WOONKAMER.occluders, seat)).not.toBeNull();
      const t = grid.tileAt(seat.approach);
      expect(t && grid.isWalkable(...t)).toBe(true);
    }
  });
  it("finds the seat nearest to a tap", () => {
    const seat = WOONKAMER.seats[0];
    expect(seatAt(WOONKAMER, [seat.hip[0] + 10, seat.hip[1] - 10])?.id).toBe(seat.id);
    expect(seatAt(WOONKAMER, [200, 1400])).toBeNull();
  });
  it("puts the zitAnker exactly on the hip point at the standing scale", () => {
    const [x, y] = sitOrigin([1000, 600], { x: 160, y: 168 }, 1.25);
    expect(x + 160 * 1.25).toBe(1000);
    expect(y + 168 * 1.25).toBe(600);
  });
});
