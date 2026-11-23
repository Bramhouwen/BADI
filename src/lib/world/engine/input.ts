/**
 * Touch and mouse on the world canvas: a tap walks, a drag looks around,
 * two fingers or the mouse wheel zoom.
 */
export interface InputHandlers {
  tap(x: number, y: number): void;
  pan(dx: number, dy: number): void;
  zoom(factor: number, x: number, y: number): void;
}

export function attachInput(el: HTMLElement, h: InputHandlers): () => void {
  const pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
  let dragging = false;
  let pinchDist = 0;
  const local = (e: PointerEvent | WheelEvent) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: PointerEvent) => {
    el.setPointerCapture?.(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      dragging = true;
    }
  };
  const move = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const q = local(e);
    if (pointers.size === 1) {
      if (!dragging && Math.hypot(q.x - p.sx, q.y - p.sy) > 8) dragging = true;
      if (dragging) h.pan(q.x - p.x, q.y - p.y);
    }
    p.x = q.x;
    p.y = q.y;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0 && d > 0) h.zoom(d / pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinchDist = d;
    }
  };
  const up = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (p && !dragging && pointers.size === 0 && e.type === "pointerup") h.tap(p.x, p.y);
    if (pointers.size === 0) {
      dragging = false;
      pinchDist = 0;
    }
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = local(e);
    h.zoom(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  };

  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("wheel", wheel, { passive: false });
  return () => {
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
    el.removeEventListener("wheel", wheel);
  };
}
