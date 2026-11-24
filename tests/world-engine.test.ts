import { describe, expect, it } from "vitest";
import { pointInPolygon, polylineYAt } from "@/lib/world/engine/geometry";
import { buildGrid } from "@/lib/world/engine/grid";
import { findPath, smoothPath } from "@/lib/world/engine/pathfinding";
import { backToFront, occludersOver } from "@/lib/world/engine/depth";
import { frameIndex } from "@/lib/world/engine/sprites";
import { newAvatar, sit, step, walk } from "@/lib/world/engine/avatar";
import { WOONKAMER } from "@/lib/world/scenes/woonkamer";
import { SCENES } from "@/lib/world/scenes";
import { fastForward, placeAtEnd, startIntent } from "@/lib/world/engine/moves";
import { readPresence, readSpeech, secondsSince, SPEECH_MAX, speechSeconds } from "@/lib/world/engine/presence";
import { ease, followTarget, heading, startZoom, toggledZoom, zoomLevels } from "@/lib/world/engine/camera";
import { readSeats, seatAt, seatForeground, seatOccluder, sitOrigin } from "@/lib/world/engine/seats";

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
  it("draws the armrest in front over someone in the armchair, and nothing in the middle of the sofa that is not there", () => {
    const chair = WOONKAMER.seats.find((s) => seatOccluder(WOONKAMER.occluders, s) === "fauteuil")!;
    expect(seatForeground(WOONKAMER.occluders, chair).length).toBeGreaterThan(0);
    const middle = WOONKAMER.seats.find((s) => s.id === "zit-2")!;
    for (const poly of seatForeground(WOONKAMER.occluders, middle)) expect(pointInPolygon(middle.hip, poly)).toBe(false);
  });
  it("puts the zitAnker exactly on the hip point at the standing scale", () => {
    const [x, y] = sitOrigin([1000, 600], { x: 160, y: 168 }, 1.25);
    expect(x + 160 * 1.25).toBe(1000);
    expect(y + 168 * 1.25).toBe(600);
  });
});

describe("scenes", () => {
  const scenes = Object.values(SCENES);
  it("has the house (the dollhouse, the back garden, four own rooms with their extra spaces), outside, the office and the gym", () => {
    const rooms = ["kamer-anne", "kamer-bram", "kamer-daphne", "kamer-irene"];
    const spaces = rooms.flatMap((r) => ["badkamer", "gym", "tuin", "zolder"].map((s) => `${r}-${s}`));
    expect(Object.keys(SCENES).sort()).toEqual(["buiten", ...rooms, ...spaces, "kantoor", "sportschool", "huis", "achtertuin"].sort());
  });
  for (const scene of scenes) {
    describe(scene.id, () => {
      const grid = buildGrid(scene);
      const startTile = grid.tileAt(scene.spawn)!;
      const reach = (p: readonly [number, number]) => {
        const t = grid.tileAt([p[0], p[1]]);
        return Boolean(t && grid.isWalkable(...t) && findPath(grid, startTile, t));
      };
      it("starts on free floor", () => {
        expect(grid.isWalkable(...startTile)).toBe(true);
      });
      it("every door leads to a scene with a door back, and you can walk to it", () => {
        for (const d of scene.doors) {
          expect(reach(d.approach)).toBe(true);
          expect(d.to && SCENES[d.to]).toBeTruthy();
          const back = SCENES[d.to!].doors.find((x) => x.id === d.arrive);
          expect(back).toBeTruthy();
          // An extra space opens onto its room's door, which leads to the landing; every other door has its own door back.
          if (!scene.owner) {
            expect(back?.to).toBe(scene.id);
            expect(back?.arrive).toBe(d.id);
          }
        }
      });
      it("every seat and spot can be walked to", () => {
        for (const s of scene.seats) expect(reach(s.approach), s.id).toBe(true);
        for (const s of scene.spots) {
          expect(reach(s.approach), s.id).toBe(true);
          // On it (a treadmill), or on free floor in front of it (the stove, the Weekrad).
          expect(pointInPolygon(s.at, s.tap) || reach(s.at), s.id).toBe(true);
        }
      });
      it("a seat names furniture that exists", () => {
        for (const s of scene.seats) if (s.on) expect(scene.occluders.some((o) => o.id === s.on), s.id).toBe(true);
      });
      it("finds a route across the scene quickly", () => {
        let far: [number, number] | null = null;
        for (let u = grid.nu - 1; u >= 0 && !far; u--) for (let v = grid.nv - 1; v >= 0 && !far; v--) if (grid.isWalkable(u, v) && findPath(grid, startTile, [u, v])) far = [u, v];
        const t0 = performance.now();
        expect(findPath(grid, startTile, far!)).not.toBeNull();
        expect(performance.now() - t0).toBeLessThan(60);
      });
    });
  }
});

describe("camera", () => {
  const phone = { width: 390, height: 844, dpr: 3 };
  const desktop = { width: 1440, height: 800, dpr: 2 };
  it("shows a whole room at the start, also on a phone held upright", () => {
    for (const view of [phone, desktop]) {
      const z = startZoom(WOONKAMER, zoomLevels(WOONKAMER, view));
      expect(WOONKAMER.width * z).toBeLessThanOrEqual(view.width + 0.5);
      expect(WOONKAMER.height * z).toBeLessThanOrEqual(view.height + 0.5);
    }
  });
  it("starts outside close to your character, because the village does not fit one screen", () => {
    const l = zoomLevels(SCENES.buiten, phone);
    expect(startZoom(SCENES.buiten, l)).toBe(l.close);
    expect(l.close).toBeGreaterThan(l.overview * 2);
  });
  it("switches between the whole picture and close by with a double tap", () => {
    const l = zoomLevels(WOONKAMER, phone);
    expect(toggledZoom(l.overview, l)).toBe(l.close);
    expect(toggledZoom(l.close, l)).toBe(l.overview);
    expect(l.close).toBeLessThanOrEqual(l.max);
  });
  it("looks ahead in the direction you walk", () => {
    const h = heading([100, 100], [300, 100]);
    expect(h).toEqual([1, 0]);
    const ahead = followTarget([100, 100], h, WOONKAMER, phone, 0.5);
    const still = followTarget([100, 100], [0, 0], WOONKAMER, phone, 0.5);
    expect(ahead[0]).toBeGreaterThan(still[0] + 100);
    expect(heading([5, 5], undefined)).toEqual([0, 0]);
  });
  it("eases the same amount over a second at any frame rate", () => {
    let a = 0, b = 0;
    for (let i = 0; i < 60; i++) a = ease(a, 1, 3, 1 / 60);
    for (let i = 0; i < 30; i++) b = ease(b, 1, 3, 1 / 30);
    expect(Math.abs(a - b)).toBeLessThan(1e-9);
  });
});

describe("together in the world", () => {
  const grid = buildGrid(WOONKAMER);
  const can = { canSit: true, has: () => true };
  const presence = { v: 1, name: "Anne", character: "anne", scene: "woonkamer", from: [400, 1000], intent: { kind: "seat", id: "zit-2" }, at: 1000 };
  it("reads a move from the channel", () => {
    expect(readPresence(presence)?.intent).toEqual({ kind: "seat", id: "zit-2" });
  });
  it("ignores broken or strange messages", () => {
    expect(readPresence({ ...presence, v: 2 })).toBeNull();
    expect(readPresence({ ...presence, character: "../../x" })).toBeNull();
    expect(readPresence({ ...presence, from: [1, Number.NaN] })).toBeNull();
    expect(readPresence({ ...presence, intent: { kind: "fly", to: [1, 2] } })).toBeNull();
    expect(readPresence({ ...presence, name: "x".repeat(41) })).toBeNull();
    expect(readPresence(null)).toBeNull();
  });
  it("keeps a speech balloon to one short line, and drops empty ones", () => {
    expect(readSpeech({ from: "u1", scene: "woonkamer", text: "  hoi\n\n daar " })?.text).toBe("hoi daar");
    expect(readSpeech({ from: "u1", scene: "woonkamer", text: "x".repeat(300) })?.text).toHaveLength(SPEECH_MAX);
    expect(readSpeech({ from: "u1", scene: "woonkamer", text: "   " })).toBeNull();
    expect(speechSeconds("hoi")).toBeGreaterThan(3);
    expect(speechSeconds("x".repeat(120))).toBeLessThanOrEqual(9);
  });
  it("walks someone to a seat and sits them down, like your own tap", () => {
    const a = newAvatar("anne", "anne", "Anne", [400, 1000], 0);
    expect(startIntent(a, WOONKAMER, grid, { kind: "seat", id: "zit-2" }, 0, can)).toBe("ok");
    fastForward(a, 60, 0);
    expect(a.state).toBe("sit");
    expect(a.seat).toBe("zit-2");
  });
  it("shows someone halfway when they started walking before you came in", () => {
    const a = newAvatar("anne", "anne", "Anne", [400, 1000], 0);
    startIntent(a, WOONKAMER, grid, { kind: "stand", to: [1500, 1100] }, 0, can);
    fastForward(a, 2, 0);
    expect(a.state).toBe("walk");
    expect(a.feet[0]).toBeGreaterThan(400);
    expect(a.feet[0]).toBeLessThan(1500);
    expect(secondsSince(0, 10_000_000)).toBe(120);
    expect(secondsSince(5000, 1000)).toBe(0);
  });
  it("puts someone straight on their seat, or next to a spot without the pose", () => {
    const a = newAvatar("bram", "bram", "Bram", [400, 1000], 0);
    placeAtEnd(a, WOONKAMER, { kind: "seat", id: "zit-4" }, 0, can);
    expect(a.state).toBe("sit");
    const b = newAvatar("bram", "bram", "Bram", [400, 1000], 0);
    placeAtEnd(b, WOONKAMER, { kind: "seat", id: "zit-4" }, 0, { canSit: false, has: () => false });
    expect(b.state).toBe("idle");
    expect(b.feet).toEqual(WOONKAMER.seats.find((s) => s.id === "zit-4")!.approach);
  });
  it("says so when a seat cannot be reached or sat on", () => {
    const a = newAvatar("x", "anne", "X", [400, 1000], 0);
    expect(startIntent(a, WOONKAMER, grid, { kind: "seat", id: "bestaat-niet" }, 0, can)).toBe("unreachable");
    expect(startIntent(a, WOONKAMER, grid, { kind: "seat", id: "zit-2" }, 0, { canSit: false, has: () => true })).toBe("cannot");
  });
});
