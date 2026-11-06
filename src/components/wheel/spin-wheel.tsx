"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { spinWheel, type SpinOutcome } from "@/app/actions/wheel";
import { CATEGORY_META, landingRotation, segments as toSegments, type Odds } from "@/lib/wheel";
import { WheelGraphic } from "./wheel-graphic";
import { CategoryIcon } from "./category-icon";
import { ClaimForm } from "./claim-form";
import { Confetti } from "./confetti";
import { Countdown } from "./countdown";

type Phase = "idle" | "spinning" | "revealed";

export function SpinWheel({ odds, canSpin, nextAt, serverNow }: { odds: Odds[]; canSpin: boolean; nextAt: string; serverNow: number }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const segs = useMemo(() => toSegments(odds), [odds]);
  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<SpinOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState(!canSpin);
  const spinning = useRef(false);

  async function spin() {
    if (spinning.current || used) return;
    spinning.current = true;
    setError(null);
    setPhase("spinning");
    const res = await spinWheel();
    if (!res.ok || !res.data) {
      spinning.current = false;
      setPhase("idle");
      setError(res.ok ? "Draaien lukte niet." : res.error);
      return;
    }
    setOutcome(res.data);
    setUsed(true);
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
    router.refresh();
  }

  const prize = outcome && outcome.category !== "challenge";

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
          onClick={spin}
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
          <p className="text-[13px] text-muted">1 draaibeurt deze week. Vervalt zondag 23:59.</p>
        )}
      </div>

      <AnimatePresence>
        {phase === "revealed" && outcome ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="wheel-reveal-title">
            {prize ? <Confetti /> : null}
            <motion.div className="absolute inset-0 bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
            <motion.div
              className="relative z-[55] m-3 w-full max-w-md rounded-[28px] bg-[#fbf7f2] p-5 pb-[calc(20px+var(--sab))] shadow-2xl"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.94 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
            >
              <button type="button" onClick={close} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-blush" aria-label="Sluiten">
                <X className="h-5 w-5" strokeWidth={1.7} />
              </button>
              {prize ? (
                <div className="space-y-4 text-center">
                  <div className="relative mx-auto mt-2 flex aspect-square w-full max-w-[220px] items-center justify-center overflow-hidden rounded-[24px]" style={{ background: CATEGORY_META[outcome.category].color }}>
                    {outcome.image ? (
                      <Image src={outcome.image} alt={`${outcome.brand} ${outcome.name}`} width={440} height={440} className="h-full w-full object-cover" unoptimized />
                    ) : (
                      <CategoryIcon category={outcome.category} className="h-20 w-20 text-white" strokeWidth={1.4} />
                    )}
                  </div>
                  <div>
                    <h2 id="wheel-reveal-title" className="font-display text-[26px] leading-tight text-text">
                      YES! Jij hebt gewonnen! 🎉
                    </h2>
                    <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.16em] text-muted">{outcome.brand}</p>
                    <p className="text-[18px] font-semibold text-text">{outcome.name}</p>
                    {outcome.description ? <p className="mt-1.5 text-[13.5px] leading-snug text-muted">{outcome.description}</p> : null}
                  </div>
                  <ClaimForm spinId={outcome.spinId} variantLabel={outcome.variantLabel} variants={outcome.variants} />
                  <Link href="/wheel/prizes" className="block text-[13px] text-muted underline-offset-2 hover:underline">
                    Naar mijn prijzenkast
                  </Link>
                </div>
              ) : outcome.challenge ? (
                <div className="space-y-4 text-center">
                  <div className="mx-auto mt-2 flex h-24 w-24 items-center justify-center rounded-full" style={{ background: CATEGORY_META.challenge.color }}>
                    <CategoryIcon category="challenge" className="h-11 w-11 text-white" strokeWidth={1.6} />
                  </div>
                  <div>
                    <h2 id="wheel-reveal-title" className="font-display text-[26px] leading-tight text-text">
                      Nieuwe challenge unlocked! 🔥
                    </h2>
                    <p className="mt-2 text-[18px] font-semibold text-text">{outcome.challenge.title}</p>
                    <p className="mt-1.5 text-[13.5px] leading-snug text-muted">{outcome.challenge.rule}</p>
                    <p className="mt-2 text-[13px] font-medium text-ink">Voltooid: +5 bonuspunten deze week.</p>
                  </div>
                  <Link href="/wheel/prizes" className="espresso flex h-[52px] w-full items-center justify-center rounded-full text-[15px] font-semibold">
                    Bekijk mijn challenge
                  </Link>
                </div>
              ) : null}
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
