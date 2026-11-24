"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { respinWheel, spinWheel, type SpinOutcome } from "@/app/actions/wheel";
import { landingRotation, segments as toSegments, type Odds } from "@/lib/wheel";
import { WheelGraphic } from "./wheel-graphic";
import { WheelReveal } from "./wheel-reveal";
import { Countdown } from "./countdown";

type Phase = "idle" | "spinning" | "revealed";

/**
 * `unlimited`: demo only, the wheel can be spun again after every reveal.
 * `onSpun`: the outcome is known (World of Badi shows it to everyone in the
 * back garden). `onDone`: closing the reveal, instead of refreshing the page.
 */
export function SpinWheel({
  odds,
  canSpin,
  unlimited = false,
  nextAt,
  serverNow,
  onSpun,
  onDone,
}: {
  odds: Odds[];
  canSpin: boolean;
  unlimited?: boolean;
  nextAt: string;
  serverNow: number;
  onSpun?: (category: SpinOutcome["category"]) => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const segs = useMemo(() => toSegments(odds), [odds]);
  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<SpinOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState(!canSpin);
  const spinning = useRef(false);

  /** `respinOf`: give back a duplicate prize and spin again. */
  async function spin(respinOf?: string) {
    if (spinning.current || (used && !respinOf)) return;
    spinning.current = true;
    setError(null);
    setPhase("spinning");
    const res = respinOf ? await respinWheel(respinOf) : await spinWheel();
    if (!res.ok || !res.data) {
      spinning.current = false;
      setPhase("idle");
      setError(res.ok ? "Draaien lukte niet." : res.error);
      return;
    }
    setOutcome(res.data);
    setUsed(!unlimited);
    onSpun?.(res.data.category);
    setRotation((r) => landingRotation(segs, res.data!.category, r, Math.random(), reduce ? 1 : 6));
    // transitionend does not fire in a background tab: reveal on a timer as well.
    setTimeout(landed, (reduce ? 600 : 5200) + 250);
  }

  function landed() {
    if (!spinning.current) return;
    spinning.current = false;
    setPhase("revealed");
  }

  function close() {
    setPhase("idle");
    if (onDone) onDone();
    else router.refresh();
  }


  return (
    <div className="flex flex-col items-center">
      <div className="relative aspect-square w-full max-w-[340px]">
        {/* Pointer */}
        <svg viewBox="0 0 40 48" className="absolute left-1/2 top-[-10px] z-10 h-11 w-9 -translate-x-1/2 drop-shadow-[0_3px_4px_rgba(95,53,41,0.35)]" aria-hidden>
          <path d="M20 46 L6 18 Q4 14 7 11 L16 3 Q20 0 24 3 L33 11 Q36 14 34 18 Z" fill="#6e4034" stroke="#fbf3ec" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="20" cy="13" r="4.5" fill="#fbf3ec" />
        </svg>
        <div
          className="h-full w-full rounded-full shadow-[0_26px_50px_-22px_rgba(95,53,41,0.6)]"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: phase === "spinning" ? (reduce ? "transform 0.6s ease-out" : "transform 5.2s cubic-bezier(0.12, 0.8, 0.14, 1)") : "none",
          }}
          onTransitionEnd={landed}
        >
          <WheelGraphic segments={segs} />
        </div>
        <button
          type="button"
          onClick={() => spin()}
          disabled={used || phase === "spinning"}
          className="absolute left-1/2 top-1/2 flex h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-full bg-[#6e4034] text-[#fbf3ec] shadow-[0_8px_18px_-8px_rgba(60,30,20,0.7)] ring-[5px] ring-[#fbf3ec] transition-transform active:scale-95 disabled:cursor-default"
          aria-label={used ? "Je draaibeurt van deze week is gebruikt" : "Draai aan het rad"}
        >
          <Image src="/brand/runner.png" alt="" width={44} height={38} className="h-auto w-[38%]" priority />
          <span className="font-display text-[17px] italic leading-none" style={{ color: "#fbf3ec" }}>
            {used ? "Weekrad" : "Draai!"}
          </span>
        </button>
      </div>

      <div className="mt-5 min-h-[44px] text-center" aria-live="polite">
        {error ? (
          <p className="text-[13px] text-danger" role="alert">
            {error}
          </p>
        ) : phase === "spinning" ? (
          <p className="text-[13px] text-muted">Het rad draait</p>
        ) : used ? (
          <p className="text-[13px] text-muted">
            Nieuwe draaibeurt over <span className="font-medium text-ink"><Countdown target={nextAt} serverNow={serverNow} /></span>
            <br />
            maandag 00:00
          </p>
        ) : (
          <div className="space-y-2.5">
            <button type="button" onClick={() => spin()} className="espresso h-[52px] rounded-full px-8 text-[15px] font-semibold tracking-wide transition-transform active:scale-[0.98]">
              DRAAI HET RAD
            </button>
            <p className="text-[12.5px] text-muted">{unlimited ? "Demo: onbeperkt draaien." : "1 draaibeurt deze week. Vervalt zondag 23:59."}</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {phase === "revealed" && outcome ? <WheelReveal outcome={outcome} onClose={close} onRespin={() => spin(outcome.spinId)} /> : null}
      </AnimatePresence>
    </div>
  );
}
