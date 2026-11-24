"use client";

/**
 * The Weekrad in the back garden of World of Badi: the bar that says who is
 * still missing and whose turn it is, the app's own wheel when it is your
 * turn, and the pictures of the wheel for the canvas. See wheel-ring.ts.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { CATEGORY_META, landingRotation, segments as toSegments, type Odds, type Segment } from "@/lib/wheel";
import { WHEEL_SPIN_MS, type RingState } from "@/lib/world/wheel-ring";
import { WheelGraphic } from "@/components/wheel/wheel-graphic";
import { SpinWheel } from "@/components/wheel/spin-wheel";
import type { SpinOutcome } from "@/app/actions/wheel";
import { joinNames } from "@/lib/super-badi";

export interface WheelData {
  odds: Odds[];
  /** Who spun this week, when the world opened. */
  spunBy: string[];
  nextAt: string;
  serverNow: number;
  /** Demo: spin as often as you like. */
  demo: boolean;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** An SVG string as an image the canvas can draw. */
function svgImage(markup: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

/** The pointer of the Weekrad page, at the top of a box of -110 to 110 around the wheel. */
const POINTER = `<svg xmlns="${SVG_NS}" viewBox="-110 -110 220 220" width="440" height="440"><g transform="translate(-10.6 -112) scale(0.53)"><path d="M20 46 L6 18 Q4 14 7 11 L16 3 Q20 0 24 3 L33 11 Q36 14 34 18 Z" fill="#6e4034" stroke="#fbf3ec" stroke-width="2" stroke-linejoin="round"/><circle cx="20" cy="13" r="4.5" fill="#fbf3ec"/></g></svg>`;

/**
 * Renders the app's wheel face out of sight once, and hands it to the canvas
 * as pictures: the face (turns) and the pointer (stays).
 */
export function useWheelPictures(odds: readonly Odds[], onReady: (pics: { face: HTMLImageElement; pointer: HTMLImageElement; segments: readonly Segment[] }) => void) {
  const segments = useMemo(() => toSegments(odds), [odds]);
  const host = useRef<HTMLDivElement>(null);
  const ready = useRef(onReady);
  useEffect(() => {
    ready.current = onReady;
  });
  useEffect(() => {
    const svg = host.current?.querySelector("svg");
    if (!svg) return;
    const copy = svg.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("xmlns", SVG_NS);
    copy.setAttribute("viewBox", "-110 -110 220 220");
    copy.setAttribute("width", "440");
    copy.setAttribute("height", "440");
    copy.removeAttribute("class");
    let alive = true;
    void Promise.all([svgImage(new XMLSerializer().serializeToString(copy)), svgImage(POINTER)]).then(([face, pointer]) => {
      if (alive) ready.current({ face, pointer, segments });
    });
    return () => {
      alive = false;
    };
  }, [segments]);
  const hidden = (
    <div ref={host} aria-hidden className="pointer-events-none fixed -left-[9999px] top-0 h-[220px] w-[220px] opacity-0">
      <WheelGraphic segments={segments} />
    </div>
  );
  return { segments, hidden };
}

/** Under the top bar in the back garden: who is still missing, whose turn it is, or your turn. */
export function WheelBar({
  ring,
  me,
  inSquare,
  total,
  nameOf,
  spunMyself,
  onSpin,
}: {
  ring: RingState;
  me: string;
  inSquare: boolean;
  total: number;
  nameOf: (id: string) => string;
  spunMyself: boolean;
  onSpin: () => void;
}) {
  const standing = ring.order.length;
  let text: string;
  if (ring.done) text = "Iedereen heeft deze week aan het Weekrad gedraaid.";
  else if (!inSquare) text = `Weekrad: ga in een vakje voor het rad staan. ${standing} van ${total} staan er.`;
  else if (!ring.complete) text = `Wachten op ${joinNames(ring.missing.map(nameOf))}. ${standing} van ${total} staan er.`;
  else if (ring.turn === me) text = "";
  else if (ring.turn) text = `${nameOf(ring.turn)} is aan de beurt.`;
  else text = spunMyself ? "Je hebt deze week gedraaid." : "Iedereen heeft gedraaid.";
  return (
    <div className="pointer-events-auto mx-auto w-full max-w-md rounded-[18px] bg-white/95 px-3.5 py-2.5 text-[13px] text-text shadow-md ring-1 ring-ink/[0.06]" role="status">
      {text ? (
        <p>{text}</p>
      ) : (
        <button type="button" onClick={onSpin} className="espresso h-11 w-full rounded-full text-[14px] font-semibold">
          Jij bent aan de beurt: draai het Weekrad
        </button>
      )}
    </div>
  );
}

/** Your turn: the wheel of the Weekrad page, with its reveal, duplicate choice and claim form. */
export function WheelTurn({ data, onSpun, onClose }: { data: WheelData; onSpun: (category: SpinOutcome["category"]) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" role="dialog" aria-modal="true" aria-label="Weekrad">
      <div className="relative m-3 w-full max-w-md rounded-[28px] bg-[#fbf7f2] p-5 pb-[calc(20px+var(--sab))] shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-muted" aria-label="Sluiten">
          <X className="h-4 w-4" aria-hidden />
        </button>
        <h2 className="mb-4 text-center font-display text-[28px] text-ink">Weekrad</h2>
        <SpinWheel odds={data.odds} canSpin unlimited={data.demo} nextAt={data.nextAt} serverNow={data.serverNow} onSpun={onSpun} onDone={onClose} />
      </div>
    </div>
  );
}

/**
 * Someone else spins: the wheel big on everyone's screen in the back garden,
 * turning to where it lands (the same as the wheel in the garden), with the
 * outcome once it stops. Mounted anew for every spin.
 */
export function WheelShow({ segments, name, category, seed }: { segments: readonly Segment[]; name: string; category: SpinOutcome["category"]; seed: number }) {
  const [rotation, setRotation] = useState(0);
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setRotation(landingRotation(segments, category, 0, seed, 6)));
    const stop = setTimeout(() => setLanded(true), WHEEL_SPIN_MS + 150);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(stop);
    };
  }, [segments, category, seed]);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--sat)+76px)] z-30 flex flex-col items-center" role="status" aria-live="polite">
      <div className="rounded-[24px] bg-white/92 px-4 pb-3 pt-2.5 shadow-xl ring-1 ring-ink/[0.06] backdrop-blur">
        <p className="mb-2 text-center text-[13px] font-semibold text-text">{landed ? `${name}: ${CATEGORY_META[category].label}` : `${name} draait aan het Weekrad`}</p>
        <div className="relative mx-auto h-[190px] w-[190px]">
          <svg viewBox="0 0 40 48" className="absolute left-1/2 top-[-8px] z-10 h-8 w-7 -translate-x-1/2" aria-hidden>
            <path d="M20 46 L6 18 Q4 14 7 11 L16 3 Q20 0 24 3 L33 11 Q36 14 34 18 Z" fill="#6e4034" stroke="#fbf3ec" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="20" cy="13" r="4.5" fill="#fbf3ec" />
          </svg>
          <div className="h-full w-full" style={{ transform: `rotate(${rotation}deg)`, transition: `transform ${WHEEL_SPIN_MS / 1000}s cubic-bezier(0.12, 0.8, 0.14, 1)` }}>
            <WheelGraphic segments={segments} />
          </div>
        </div>
      </div>
    </div>
  );
}
