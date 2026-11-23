"use client";

import { useEffect, useRef, useState } from "react";
import { saveWorldPosition } from "@/app/actions/world";
import { act, newAvatar, sit, step, walk, walkSpeedFor, type Avatar } from "@/lib/world/engine/avatar";
import { dist, pointInPolygon, type Pt } from "@/lib/world/engine/geometry";
import { buildGrid, type Grid } from "@/lib/world/engine/grid";
import { attachInput } from "@/lib/world/engine/input";
import { findPath, smoothPath } from "@/lib/world/engine/pathfinding";
import { clampCamera, drawSeatMarker, render, screenToScene, type Camera, type View } from "@/lib/world/engine/renderer";
import { occluderUnder, seatAt, seatOccluder } from "@/lib/world/engine/seats";
import { loadCharacter, type LoadedCharacter } from "@/lib/world/engine/sprites";
import type { Door, SceneDef, Seat, Spot } from "@/lib/world/engine/scene";

const PAGE = "#f6ece4";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

/** The route from the avatar to a spot, in background pixels, ending exactly on the spot when it is free floor. */
function routeTo(grid: Grid, from: Pt, to: Pt): Pt[] | null {
  const startTile = grid.tileAt(from);
  const start = startTile && grid.isWalkable(...startTile) ? startTile : grid.nearestWalkable(from);
  const goalTile = grid.tileAt(to);
  const exact = Boolean(goalTile && grid.isWalkable(...goalTile));
  const goal = exact ? goalTile : grid.nearestWalkable(to);
  if (!start || !goal) return null;
  const tiles = findPath(grid, start, goal);
  if (!tiles) return null;
  const pts = smoothPath(grid, tiles).map(([u, v]) => grid.tileToPx(u + 0.5, v + 0.5));
  if (exact) pts[pts.length - 1] = to;
  return pts;
}

/** Centre of the walkable tile nearest to a point: where you walk to before sitting down. */
function approachFor(grid: Grid, p: Pt): Pt | null {
  const t = grid.nearestWalkable([p[0], p[1] + 60]);
  return t ? grid.tileToPx(t[0] + 0.5, t[1] + 0.5) : null;
}

const round = (p: Pt): Pt => [Math.round(p[0]), Math.round(p[1])];

interface EditorActions {
  tryOut(id: string): void;
}

/**
 * One scene of BADI Wereld on a canvas: your character walks where you tap,
 * around furniture and behind it, sits on seats and walks to the door. Drag
 * to look around, pinch or scroll to zoom. `overlay` shows the walking grid.
 *
 * `edit` is the placement mode: tap the seat of a sofa or chair to add a seat
 * (its hip point), drag the pink hip point or the green walking spot, set the
 * facing, try it out with your own character and save it to the scene's JSON.
 */
export function WorldCanvas({
  scene,
  me,
  startX = null,
  startY = null,
  debug = false,
  overlay = false,
  edit = false,
  arriveAt = null,
  onDoor,
  onReady,
}: {
  scene: SceneDef;
  me: { id: string; name: string; character: string | null };
  startX?: number | null;
  startY?: number | null;
  debug?: boolean;
  overlay?: boolean;
  edit?: boolean;
  /** Door in this scene you come in through. */
  arriveAt?: string | null;
  /** You walked into a door that leads to another scene. */
  onDoor?: (door: Door) => void;
  /** The scene is loaded and drawn. */
  onReady?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const fpsRef = useRef<HTMLParagraphElement>(null);
  // Latest callbacks, so a new function from the parent does not restart the scene.
  const onDoorRef = useRef(onDoor);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onDoorRef.current = onDoor;
    onReadyRef.current = onReady;
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [note, setNote] = useState<string | null>(null);
  // Placement mode: the seats being edited, shared between the canvas loop and the panel.
  const [seats, setSeats] = useState<Seat[]>(() => scene.seats.map((s) => ({ ...s })));
  const seatsRef = useRef<Seat[]>(seats);
  const selectedRef = useRef<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<string | null>(null);
  const actionsRef = useRef<EditorActions | null>(null);

  const commit = (next: Seat[], sel: string | null = selectedRef.current) => {
    seatsRef.current = next;
    selectedRef.current = sel;
    setSeats(next);
    setSelected(sel);
    setSaveState(null);
  };

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas || !me.character) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let alive = true;
    let raf = 0;
    let noteTimer: ReturnType<typeof setTimeout> | undefined;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let detach: (() => void) | null = null;
    let ro: ResizeObserver | null = null;
    const say = (text: string) => {
      setNote(text);
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => setNote(null), 3200);
    };
    // The scene as it is being edited: same as `scene`, with the seats from the placement mode.
    const live = (): SceneDef => (edit ? { ...scene, seats: seatsRef.current } : scene);

    const grid = buildGrid(scene);
    const outlines = new Map(
      scene.occluders.map((o) => {
        const p = new Path2D();
        o.outline.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
        p.closePath();
        return [o.id, p] as const;
      }),
    );
    const view: View = { width: 1, height: 1, dpr: 1 };
    let cam: Camera = { x: scene.width / 2, y: scene.height / 2, zoom: 0.5 };
    let lastPan = -Infinity;
    const zoomLimits = () => {
      // The picture always fills the screen: never zoom out past the point where empty edges show.
      const min = Math.max(view.width / scene.width, view.height / scene.height);
      // The closest zoom keeps a character as large as it can be in the rooms, also outside where characters are drawn smaller.
      const max = Math.max(min, (1.3 * 340) / scene.characterHeight);
      return { min, max, start: Math.min(max, min * (scene.startZoom ?? 1)) };
    };
    const resize = () => {
      const r = box.getBoundingClientRect();
      view.width = Math.max(1, r.width);
      view.height = Math.max(1, r.height);
      view.dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(view.width * view.dpr);
      canvas.height = Math.round(view.height * view.dpr);
      canvas.style.width = view.width + "px";
      canvas.style.height = view.height + "px";
      const { min, max } = zoomLimits();
      cam = clampCamera({ ...cam, zoom: Math.min(max, Math.max(min, cam.zoom)) }, scene, view);
    };

    (async () => {
      try {
        const [background, character] = await Promise.all([loadImage(scene.background), loadCharacter(me.character!)]);
        if (!alive) return;
        const characters = new Map<string, LoadedCharacter>([[character.key, character]]);
        const now0 = performance.now();
        const door = arriveAt ? scene.doors.find((d) => d.id === arriveAt) : null;
        const start: Pt | null = door ? door.approach : startX !== null && startY !== null ? [startX, startY] : null;
        const startTile = start ? grid.tileAt(start) : null;
        const feet: Pt = start && startTile && grid.isWalkable(...startTile) ? start : scene.spawn;
        const me0: Avatar = newAvatar(me.id, character.key, me.name, feet, now0);
        me0.speed = scene.walkSpeed ?? walkSpeedFor(scene.characterHeight);
        if (door) me0.facing = door.approach[0] < scene.width / 2 ? "right" : "left";
        const avatars = [me0];

        resize();
        cam = clampCamera({ x: feet[0], y: feet[1] - scene.characterHeight * 0.4, zoom: edit ? zoomLimits().min : zoomLimits().start }, scene, view);
        ro = new ResizeObserver(resize);
        ro.observe(box);

        const remember = () => {
          if (edit) return;
          clearTimeout(saveTimer);
          saveTimer = setTimeout(() => void saveWorldPosition({ scene: scene.id, x: me0.feet[0], y: me0.feet[1] }), 1200);
        };
        const goTo = (target: Pt, then: (() => void) | null) => {
          const route = routeTo(grid, me0.feet, target);
          if (!route) {
            say("Daar kun je niet komen.");
            return;
          }
          // Standing up or stepping off: that piece is not drawn over you while you step away from it.
          const was = me0.state === "sit" ? live().seats.find((s) => s.id === me0.seat) : null;
          const wasAt = me0.state === "act" ? scene.spots.find((s) => s.id === me0.spot) : null;
          const leaving = was ? seatOccluder(scene.occluders, was) : wasAt ? occluderUnder(scene.occluders, wasAt.at) : null;
          if (me0.state === "sit" || me0.state === "act") me0.state = "idle";
          walk(
            me0,
            route,
            performance.now(),
            () => {
              remember();
              then?.();
            },
            leaving,
          );
        };
        const sitOn = (seat: Seat) => {
          goTo(seat.approach, () => {
            if (character.manifest.animations.zitten?.withChair) {
              me0.facing = seat.facing;
              say(`${me.name} heeft nog geen zitpose zonder stoel.`);
              return;
            }
            const under = seatOccluder(scene.occluders, seat);
            walk(
              me0,
              [seat.hip],
              performance.now(),
              () => {
                sit(me0, seat.id, seat.hip, seat.facing, performance.now());
                remember();
              },
              under,
            );
          });
        };

        const doSpot = (spot: Spot) => {
          goTo(spot.approach, () => {
            if (!character.manifest.animations[spot.pose]) {
              say(`${me.name} heeft nog geen animatie voor ${spot.label.toLowerCase()}.`);
              return;
            }
            const under = occluderUnder(scene.occluders, spot.at);
            walk(me0, [spot.at], performance.now(), () => act(me0, spot.id, spot.at, spot.facing, spot.pose, performance.now()), under);
          });
        };

        const tapScene = (p: Pt) => {
          const door = scene.doors.find((d) => pointInPolygon(p, d.tap));
          if (door) {
            goTo(door.approach, () => {
              if (door.to && onDoorRef.current) onDoorRef.current(door);
              else say("Deze deur gaat nog nergens heen.");
            });
            return;
          }
          const spot = scene.spots.find((s) => pointInPolygon(p, s.tap));
          if (spot) {
            doSpot(spot);
            return;
          }
          const seat = seatAt(live(), p);
          if (seat) {
            sitOn(seat);
            return;
          }
          goTo(p, null);
        };
        actionsRef.current = {
          tryOut(id) {
            const seat = seatsRef.current.find((s) => s.id === id);
            if (seat) sitOn(seat);
          },
        };
        // Debug only: drive the character from the console (window.__wereld.tap(x, y) in background pixels).
        if (debug) (window as unknown as { __wereld?: unknown }).__wereld = { tap: (x: number, y: number) => tapScene([x, y]), me: me0 };

        // Placement mode: what is under the finger.
        const HIT = 34; // screen pixels
        const hitSeat = (sx: number, sy: number): { id: string; part: "hip" | "approach" } | null => {
          const p = screenToScene(sx, sy, cam, view);
          const r = HIT / cam.zoom;
          let best: { id: string; part: "hip" | "approach"; d: number } | null = null;
          for (const s of seatsRef.current) {
            for (const part of ["hip", "approach"] as const) {
              const d = dist(s[part], p);
              if (d <= r && (!best || d < best.d)) best = { id: s.id, part, d };
            }
          }
          return best ? { id: best.id, part: best.part } : null;
        };
        let dragging: { id: string; part: "hip" | "approach" } | null = null;

        detach = attachInput(canvas, {
          tap(x, y) {
            if (!edit) {
              tapScene(screenToScene(x, y, cam, view));
              return;
            }
            const hit = hitSeat(x, y);
            if (hit) {
              commit(seatsRef.current, hit.id);
              return;
            }
            // A new seat where you tapped: that is where the hips go.
            const hip = round(screenToScene(x, y, cam, view));
            const approach = approachFor(grid, hip);
            if (!approach) {
              say("Hier is geen vloer in de buurt om naartoe te lopen.");
              return;
            }
            let n = seatsRef.current.length + 1;
            while (seatsRef.current.some((s) => s.id === `zit-${n}`)) n++;
            const seat: Seat = { id: `zit-${n}`, hip, facing: "right", approach: round(approach) };
            commit([...seatsRef.current, seat], seat.id);
          },
          grab(x, y) {
            if (!edit) return false;
            dragging = hitSeat(x, y);
            if (dragging) commit(seatsRef.current, dragging.id);
            return Boolean(dragging);
          },
          drag(x, y) {
            if (!dragging) return;
            const p = round(screenToScene(x, y, cam, view));
            const { id, part } = dragging;
            seatsRef.current = seatsRef.current.map((s) => (s.id === id ? { ...s, [part]: p } : s));
          },
          drop() {
            if (!dragging) return;
            const { id, part } = dragging;
            dragging = null;
            // The walking spot snaps to the centre of the nearest free tile.
            const next = seatsRef.current.map((s) => {
              if (s.id !== id || part !== "approach") return s;
              const t = grid.nearestWalkable(s.approach);
              return t ? { ...s, approach: round(grid.tileToPx(t[0] + 0.5, t[1] + 0.5)) } : s;
            });
            commit(next, id);
          },
          pan(dx, dy) {
            lastPan = performance.now();
            cam = clampCamera({ ...cam, x: cam.x - dx / cam.zoom, y: cam.y - dy / cam.zoom }, scene, view);
          },
          zoom(factor, x, y) {
            lastPan = performance.now();
            const { min, max } = zoomLimits();
            const before = screenToScene(x, y, cam, view);
            const zoom = Math.min(max, Math.max(min, cam.zoom * factor));
            const nx = before[0] - (x - view.width / 2) / zoom;
            const ny = before[1] - (y - view.height / 2) / zoom;
            cam = clampCamera({ x: nx, y: ny, zoom }, scene, view);
          },
        });

        setStatus("ready");
        // Coming in through a door: that is your place in this scene now.
        if (door) remember();
        let last = performance.now();
        let first = true;
        let frames = 0;
        let fpsSince = last;
        const frame = (now: number) => {
          if (!alive) return;
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          // Frames per second, in the debug view only.
          if (overlay && fpsRef.current) {
            frames++;
            if (now - fpsSince >= 500) {
              fpsRef.current.textContent = `${Math.round((frames * 1000) / (now - fpsSince))} fps`;
              frames = 0;
              fpsSince = now;
            }
          }
          step(me0, dt, now);
          // Follow your character, unless you just looked around yourself (never in the placement mode).
          if (!edit && now - lastPan > 2500) {
            const k = Math.min(1, dt * 3);
            cam = clampCamera({ ...cam, x: cam.x + (me0.feet[0] - cam.x) * k, y: cam.y + (me0.feet[1] - scene.characterHeight * 0.4 - cam.y) * k }, scene, view);
          }
          const current = live();
          render({ ctx, scene: current, background, outlines, avatars, characters, cam, view, now, grid, debug: overlay || edit, page: PAGE });
          if (edit) {
            const sel = current.seats.find((s) => s.id === selectedRef.current);
            if (sel) drawSeatMarker(ctx, sel, true);
          }
          if (first) {
            first = false;
            onReadyRef.current?.();
          }
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      } catch {
        if (alive) setStatus("error");
      }
    })();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(noteTimer);
      clearTimeout(saveTimer);
      detach?.();
      ro?.disconnect();
      actionsRef.current = null;
    };
  }, [scene, me.id, me.name, me.character, startX, startY, debug, overlay, edit, arriveAt]);

  // Delete removes the selected seat (keyboard, placement mode).
  useEffect(() => {
    if (!edit) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedRef.current && !(e.target instanceof HTMLInputElement)) {
        commit(
          seatsRef.current.filter((s) => s.id !== selectedRef.current),
          null,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edit]);

  const current = seats.find((s) => s.id === selected) ?? null;

  async function save() {
    const payload = { scene: scene.id, seats: seatsRef.current };
    setSaveState("Opslaan…");
    try {
      const res = await fetch("/api/wereld/zitplekken", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        setSaveState(`Opgeslagen in ${scene.id}.zitplekken.json`);
        return;
      }
    } catch {}
    // Not on your own computer: copy the JSON so it can go into the file by hand.
    try {
      await navigator.clipboard.writeText(JSON.stringify({ seats: seatsRef.current }, null, 2) + "\n");
      setSaveState("Opslaan in het bestand kan alleen lokaal. De JSON staat op je klembord.");
    } catch {
      setSaveState("Opslaan lukte niet. Gebruik de placement mode lokaal (npm run dev:demo).");
    }
  }

  return (
    <div className="absolute inset-0">
      <div ref={boxRef} className="absolute inset-0 touch-none select-none overflow-hidden bg-[#f6ece4]">
        <canvas ref={canvasRef} className="block h-full w-full" aria-label={`${scene.name}: tik om te lopen, sleep om rond te kijken`} role="img" />
        {status !== "ready" ? (
          <div className="absolute inset-0 grid place-items-center text-[14px] text-muted">{status === "loading" ? "De wereld laadt…" : "De wereld kon niet laden. Probeer het opnieuw."}</div>
        ) : null}
        {overlay ? <p ref={fpsRef} className="absolute right-3 rounded-full bg-text/80 px-3 py-1 text-[12px] tabular-nums text-paper" style={{ top: "calc(var(--sat) + 14px)" }} aria-live="off" /> : null}
        {note ? (
          <p className="absolute inset-x-4 mx-auto max-w-md rounded-full bg-text/90 px-4 py-2 text-center text-[13px] text-paper" style={{ bottom: "calc(var(--sab) + 18px)" }} role="status">
            {note}
          </p>
        ) : null}
      </div>

      {edit ? (
        <section
          aria-label="Plaatsingsmodus"
          className="absolute inset-x-3 mx-auto max-h-[42dvh] max-w-xl space-y-3 overflow-y-auto rounded-[20px] bg-white/92 p-4 shadow-lg ring-1 ring-ink/[0.06] backdrop-blur"
          style={{ bottom: "calc(var(--sab) + 12px)" }}
        >
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Plaatsingsmodus · {scene.name}</p>
            <p className="mt-1 text-[13px] leading-snug text-text">
              Tik op de zitting van een bank of stoel: daar komen de heupen. Sleep het <span className="font-semibold text-[#b52f74]">roze punt</span> om te verplaatsen en het{" "}
              <span className="font-semibold text-[#3f8f4f]">groene punt</span> voor de plek waar je naartoe loopt. Slepen naast de punten kijkt rond.
            </p>
          </div>

          {current ? (
            <div className="space-y-2 rounded-[16px] bg-[#f6ece4] p-3">
              <p className="text-[13px] font-medium text-text">
                {current.id} · heupen ({current.hip[0]}, {current.hip[1]}) · loopt naar ({current.approach[0]}, {current.approach[1]})
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="h-10 rounded-full bg-white px-4 text-[13px] font-medium text-ink ring-1 ring-ink/10"
                  onClick={() => commit(seatsRef.current.map((s) => (s.id === current.id ? { ...s, facing: s.facing === "left" ? "right" : "left" } : s)))}
                >
                  Kijkt naar {current.facing === "left" ? "links" : "rechts"} · wissel
                </button>
                <button type="button" className="h-10 rounded-full bg-white px-4 text-[13px] font-medium text-ink ring-1 ring-ink/10" onClick={() => actionsRef.current?.tryOut(current.id)}>
                  Probeer met je poppetje
                </button>
                <button
                  type="button"
                  className="h-10 rounded-full bg-danger/15 px-4 text-[13px] font-medium text-danger"
                  onClick={() =>
                    commit(
                      seatsRef.current.filter((s) => s.id !== current.id),
                      null,
                    )
                  }
                >
                  Verwijder
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-muted">Geen zitplek gekozen. Tik op een roze punt om er een te kiezen.</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} className="espresso h-11 rounded-full px-5 text-[14px] font-semibold">
              Opslaan ({seats.length} zitplekken)
            </button>
            {saveState ? <p className="text-[12.5px] text-muted" role="status">{saveState}</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
