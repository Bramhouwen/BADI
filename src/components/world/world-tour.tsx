"use client";

/**
 * The tour of World of Badi: one card per feature, with the button it is
 * about lit up and the rest of the screen dimmed. Opens by itself the first
 * time you come in, and with /wereld?rondleiding=1.
 */
import { useEffect, useState } from "react";
import { TOUR_STEPS } from "@/lib/world/tour";

type Box = { x: number; y: number; w: number; h: number };

function targetBox(target: string | undefined): Box | null {
  if (!target) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const pad = 6;
  return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
}

export function WorldTour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const step = TOUR_STEPS[i];
  const last = i === TOUR_STEPS.length - 1;

  // Follow the lit-up button, also when the screen turns or the keyboard moves things.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setBox(targetBox(step.target)));
    };
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    const again = setTimeout(measure, 350);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(again);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [step.target]);

  // The card goes where the lit-up button is not.
  const below = box ? box.y + box.h / 2 < window.innerHeight / 2 : false;
  const cardStyle: React.CSSProperties = !box
    ? { top: "50%", transform: "translateY(-50%)" }
    : below
      ? { top: box.y + box.h + 14 }
      : { bottom: window.innerHeight - box.y + 14 };

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Rondleiding World of Badi">
      {/* The screen dimmed, with a hole where the button is that this step is about. */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="rondleiding-gat">
            <rect width="100%" height="100%" fill="white" />
            {box ? <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={20} fill="black" /> : null}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(43,29,24,0.62)" mask="url(#rondleiding-gat)" />
      </svg>
      {box ? <div className="pointer-events-none absolute rounded-[20px] ring-2 ring-white" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} /> : null}

      <section className="absolute inset-x-4 mx-auto max-w-sm rounded-[22px] bg-white p-4 shadow-2xl" style={cardStyle} aria-live="polite">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f6ece4] text-[22px] leading-none" aria-hidden>
            {step.icon}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Rondleiding · {i + 1} van {TOUR_STEPS.length}
            </p>
            <h2 className="mt-0.5 text-[17px] font-semibold leading-snug text-text">{step.title}</h2>
          </div>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-text">{step.body}</p>

        <div className="mt-3 flex justify-center gap-1" aria-hidden>
          {TOUR_STEPS.map((_, n) => (
            <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-4 bg-[#2b1d18]" : "w-1.5 bg-ink/15"}`} />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          {!last ? (
            <button type="button" onClick={onDone} className="h-11 px-2 text-[13.5px] font-semibold text-muted">
              Overslaan
            </button>
          ) : null}
          {i > 0 ? (
            <button type="button" onClick={() => setI(i - 1)} className={`${last ? "" : "ml-auto"} h-11 rounded-full bg-[#f6ece4] px-4 text-[14px] font-semibold text-text`}>
              Vorige
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (last ? onDone() : setI(i + 1))}
            className={`espresso h-11 rounded-full px-5 text-[14px] font-semibold ${last ? "flex-1" : i > 0 ? "" : "ml-auto"}`}
          >
            {last ? "Aan de slag" : "Volgende"}
          </button>
        </div>
      </section>
    </div>
  );
}
