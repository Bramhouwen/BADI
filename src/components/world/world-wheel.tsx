"use client";

/**
 * The Weekrad in the back garden of World of Badi: the bar that says who is
 * still missing and whose turn it is (and spins on your turn), the pictures
 * of the app's wheel for the canvas, and what someone else won for the
 * reveal. The wheel turns in the garden itself; see wheel-ring.ts.
 */
import { useEffect, useMemo, useRef } from "react";
import { CHALLENGE_META, segments as toSegments, type Odds, type Segment } from "@/lib/wheel";
import type { RingState } from "@/lib/world/wheel-ring";
import { WheelGraphic } from "@/components/wheel/wheel-graphic";
import type { SpinOutcome } from "@/app/actions/wheel";
import type { WheelSpinEvent } from "./world-link";
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
  busy,
  onSpin,
}: {
  ring: RingState;
  me: string;
  inSquare: boolean;
  total: number;
  nameOf: (id: string) => string;
  spunMyself: boolean;
  /** The wheel is turning right now. */
  busy: boolean;
  onSpin: () => void;
}) {
  const standing = ring.order.length;
  let text: string;
  if (busy) text = "Het rad draait.";
  else if (ring.done) text = "Iedereen heeft deze week aan het Weekrad gedraaid.";
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
        <button type="button" onClick={onSpin} disabled={busy} className="espresso h-11 w-full rounded-full text-[14px] font-semibold disabled:opacity-60">
          {busy ? "Het rad draait" : "Jij bent aan de beurt: draai het Weekrad"}
        </button>
      )}
    </div>
  );
}

/** What someone else won, from their spin on the live link, to show in the reveal. */
export function outcomeOf(e: WheelSpinEvent): SpinOutcome {
  return {
    spinId: "",
    category: e.category,
    brand: e.prize?.brand ?? null,
    name: e.prize?.name ?? null,
    description: null,
    valueCents: null,
    url: null,
    image: e.prize?.image ?? null,
    variantLabel: null,
    variants: [],
    duplicate: false,
    alternatives: [],
    challenge: e.challenge ? { key: e.challenge, ...CHALLENGE_META[e.challenge] } : null,
  };
}
