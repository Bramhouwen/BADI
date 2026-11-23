"use client";

import { useEffect, useRef, useState } from "react";
import { saveWorldPosition } from "@/app/actions/world";
import { newAvatar, sit, step, walk, type Avatar } from "@/lib/world/engine/avatar";
import { pointInPolygon, type Pt } from "@/lib/world/engine/geometry";
import { buildGrid, type Grid } from "@/lib/world/engine/grid";
import { attachInput } from "@/lib/world/engine/input";
import { findPath, smoothPath } from "@/lib/world/engine/pathfinding";
import { clampCamera, render, screenToScene, type Camera, type View } from "@/lib/world/engine/renderer";
import { loadCharacter, type LoadedCharacter } from "@/lib/world/engine/sprites";
import type { SceneDef } from "@/lib/world/engine/scene";

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

/**
 * One scene of BADI Wereld on a canvas: your character walks where you tap,
 * around furniture and behind it, sits on seats and walks to the door.
 * Drag to look around, pinch or scroll to zoom. `debug` shows the walking grid.
 */
export function WorldCanvas({ scene, me, startX = null, startY = null, debug = false, overlay = false }: { scene: SceneDef; me: { id: string; name: string; character: string | null }; startX?: number | null; startY?: number | null; debug?: boolean; overlay?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [note, setNote] = useState<string | null>(null);

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
      const min = Math.min(view.width / scene.width, view.height / scene.height);
      return { min, max: Math.max(min, 1.3), start: Math.max(min, Math.min(1.3, view.height / (scene.height * 0.8))) };
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
        const start: Pt | null = startX !== null && startY !== null ? [startX, startY] : null;
        const startTile = start ? grid.tileAt(start) : null;
        const feet: Pt = start && startTile && grid.isWalkable(...startTile) ? start : scene.spawn;
        const me0: Avatar = newAvatar(me.id, character.key, me.name, feet, now0);
        const avatars = [me0];

        resize();
        cam = clampCamera({ x: feet[0], y: feet[1] - scene.characterHeight * 0.4, zoom: zoomLimits().start }, scene, view);
        ro = new ResizeObserver(resize);
        ro.observe(box);

        const remember = () => {
          clearTimeout(saveTimer);
          saveTimer = setTimeout(() => void saveWorldPosition({ scene: scene.id, x: me0.feet[0], y: me0.feet[1] }), 1200);
        };
        const goTo = (target: Pt, then: (() => void) | null) => {
          const route = routeTo(grid, me0.feet, target);
          if (!route) {
            say("Daar kun je niet komen.");
            return;
          }
          // Standing up: the seat is not drawn over you while you step away from it.
          const leaving = me0.state === "sit" ? (scene.seats.find((s) => s.id === me0.seat)?.sitsOn ?? null) : null;
          if (me0.state === "sit") me0.state = "idle";
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

        const tapScene = (p: Pt) => {
            const door = scene.doors.find((d) => pointInPolygon(p, d.tap));
            if (door) {
              goTo(door.approach, () => say(door.to ? door.label : "De deur naar buiten komt in de volgende stap."));
              return;
            }
            const seat = scene.seats.find((s) => pointInPolygon(p, s.tap));
            if (seat) {
              goTo(seat.approach, () => {
                if (character.manifest.animations.zitten?.withChair) {
                  me0.facing = seat.facing;
                  say(`${me.name} heeft nog geen zitpose zonder stoel.`);
                  return;
                }
                walk(
                  me0,
                  [seat.feet],
                  performance.now(),
                  () => {
                    sit(me0, seat.id, seat.feet, seat.facing, performance.now());
                    remember();
                  },
                  seat.sitsOn,
                );
              });
              return;
            }
            goTo(p, null);
        };
        // Debug only: drive the character from the console (window.__wereld.tap(x, y) in background pixels).
        if (debug) (window as unknown as { __wereld?: unknown }).__wereld = { tap: (x: number, y: number) => tapScene([x, y]), me: me0 };

        detach = attachInput(canvas, {
          tap(x, y) {
            tapScene(screenToScene(x, y, cam, view));
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
        let last = performance.now();
        const frame = (now: number) => {
          if (!alive) return;
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          step(me0, dt, now);
          // Follow your character, unless you just looked around yourself.
          if (now - lastPan > 2500) {
            const k = Math.min(1, dt * 3);
            cam = clampCamera({ ...cam, x: cam.x + (me0.feet[0] - cam.x) * k, y: cam.y + (me0.feet[1] - scene.characterHeight * 0.4 - cam.y) * k }, scene, view);
          }
          render({ ctx, scene, background, outlines, avatars, characters, cam, view, now, grid, debug: overlay, page: PAGE });
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
    };
  }, [scene, me.id, me.name, me.character, startX, startY, debug, overlay]);

  return (
    <div ref={boxRef} className="relative h-[calc(100dvh-var(--nav-h)-var(--sab)-210px)] min-h-[380px] w-full touch-none select-none overflow-hidden rounded-[24px] bg-[#f6ece4] ring-1 ring-ink/[0.06]">
      <canvas ref={canvasRef} className="block h-full w-full" aria-label={`${scene.name}: tik om te lopen, sleep om rond te kijken`} role="img" />
      {status !== "ready" ? (
        <div className="absolute inset-0 grid place-items-center text-[14px] text-muted">{status === "loading" ? "De wereld laadt…" : "De wereld kon niet laden. Probeer het opnieuw."}</div>
      ) : null}
      {note ? (
        <p className="absolute inset-x-3 bottom-3 rounded-full bg-text/90 px-4 py-2 text-center text-[13px] text-paper" role="status">
          {note}
        </p>
      ) : null}
    </div>
  );
}
