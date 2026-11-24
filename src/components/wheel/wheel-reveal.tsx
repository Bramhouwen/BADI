"use client";

/**
 * The reveal after the Weekrad stops: the prize (with confetti) or the extra
 * challenge. For the one who spun: the duplicate choice and the claim form.
 * `watcher`: someone else in World of Badi watching, by name; then it only
 * shows what they won.
 */
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { Crown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpinOutcome } from "@/app/actions/wheel";
import { CATEGORY_META } from "@/lib/wheel";
import { DuplicateChoice } from "./duplicate-choice";
import { CategoryIcon } from "./category-icon";
import { ClaimForm } from "./claim-form";
import { PrizeInfo } from "./prize-info";
import { Confetti } from "./confetti";

const GOLD_CONFETTI = ["#f3d488", "#e2b656", "#d9a63c", "#fbf3ec", "#b8832a"];

export function WheelReveal({
  outcome,
  onClose,
  onRespin,
  watcher,
}: {
  outcome: SpinOutcome;
  onClose: () => void;
  onRespin?: () => void;
  watcher?: string;
}) {
  const reduce = useReducedMotion();
  const close = onClose;
  const prize = outcome.category !== "challenge";
  const jackpot = outcome.category === "jackpot";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wheel-reveal-title"
    >
      {prize ? (
        <Confetti
          pieces={jackpot ? 140 : 70}
          colors={jackpot ? GOLD_CONFETTI : undefined}
        />
      ) : null}
      <motion.div
        className="absolute inset-0 bg-ink/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
      />
      <motion.div
        className={cn(
          "relative z-[55] m-3 w-full max-w-md rounded-[28px] p-5 pb-[calc(20px+var(--sab))] shadow-2xl",
          jackpot
            ? "jackpot-card bg-[linear-gradient(160deg,#5f3529,#3b2a24)] text-[#fbf3ec] ring-2 ring-[#e2b656]"
            : "bg-[#fbf7f2]",
        )}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.94 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-blush"
          aria-label="Sluiten"
        >
          <X className="h-5 w-5" strokeWidth={1.7} />
        </button>
        {prize ? (
          <div className="space-y-4 text-center">
            {jackpot ? (
              <p className="mt-1 flex items-center justify-center gap-2 font-display text-[30px] italic leading-none text-[#f3d488]">
                <Crown className="h-7 w-7" strokeWidth={1.6} aria-hidden />{" "}
                Jackpot
              </p>
            ) : (
              <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">
                {CATEGORY_META[outcome.category].label}
              </p>
            )}
            <div
              className={cn(
                "relative mx-auto flex aspect-square w-full max-w-[220px] items-center justify-center overflow-hidden rounded-[24px]",
                jackpot && "jackpot-glow ring-4 ring-[#e2b656]",
              )}
              style={{ background: CATEGORY_META[outcome.category].color }}
            >
              {outcome.image ? (
                <Image
                  src={outcome.image}
                  alt={`${outcome.brand} ${outcome.name}`}
                  width={440}
                  height={440}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <CategoryIcon
                  category={outcome.category}
                  className="h-20 w-20 text-white"
                  strokeWidth={1.4}
                />
              )}
            </div>
            <div>
              <h2
                id="wheel-reveal-title"
                className={cn(
                  "font-display text-[26px] leading-tight",
                  jackpot ? "text-[#fbf3ec]" : "text-text",
                )}
              >
                {watcher
                  ? `${watcher} heeft gewonnen! 🎉`
                  : "YES! Jij hebt gewonnen! 🎉"}
              </h2>
              <p
                className={cn(
                  "mt-2 text-[12px] font-medium uppercase tracking-[0.16em]",
                  jackpot ? "text-[#f3d488]" : "text-muted",
                )}
              >
                {outcome.brand}
              </p>
              <p
                className={cn(
                  "text-[18px] font-semibold",
                  jackpot ? "text-[#fbf3ec]" : "text-text",
                )}
              >
                {outcome.name}
              </p>
            </div>
            <div
              className={cn(
                jackpot && "rounded-[18px] bg-[#fbf7f2] p-3 text-text",
              )}
            >
              <PrizeInfo
                category={outcome.category}
                valueCents={outcome.valueCents}
                description={outcome.description}
                url={outcome.url}
                center
              />
            </div>
            {watcher ? null : (
              <>
                {outcome.duplicate && onRespin ? (
                  <DuplicateChoice
                    spinId={outcome.spinId}
                    brand={outcome.brand}
                    alternatives={outcome.alternatives}
                    onRespin={onRespin}
                    dark={jackpot}
                  />
                ) : null}
                <ClaimForm
                  spinId={outcome.spinId}
                  variantLabel={outcome.variantLabel}
                  variants={outcome.variants}
                />
                <Link
                  href="/wheel/prizes"
                  className={cn(
                    "block text-[13px] underline-offset-2 hover:underline",
                    jackpot ? "text-[#f3d488]" : "text-muted",
                  )}
                >
                  Naar mijn prijzenkast
                </Link>
              </>
            )}
          </div>
        ) : outcome.challenge ? (
          <div className="space-y-4 text-center">
            <Image
              src={outcome.challenge.image}
              alt={`${outcome.challenge.title}: ${outcome.challenge.rule}`}
              width={480}
              height={480}
              className="mx-auto mt-2 aspect-square w-full max-w-[240px] rounded-[22px] object-cover shadow-[0_14px_30px_-18px_rgba(95,53,41,0.5)]"
            />
            <div>
              <h2
                id="wheel-reveal-title"
                className="font-display text-[26px] leading-tight text-text"
              >
                {watcher
                  ? `${watcher} kreeg een challenge 🔥`
                  : "Nieuwe challenge unlocked! 🔥"}
              </h2>
              <p className="mt-2 text-[18px] font-semibold text-text">
                {outcome.challenge.title}
              </p>
              <p className="mt-1.5 text-[13.5px] leading-snug text-muted">
                {outcome.challenge.rule}
              </p>
              <p className="mt-2 text-[13px] font-medium text-ink">
                Voltooid: +5 bonuspunten deze week.
              </p>
              {outcome.challenge.mode === "manual" ? (
                <p className="mt-1 text-[12.5px] text-muted">
                  Tik in je prijzenkast op Gedaan zodra het gelukt is.
                </p>
              ) : (
                <p className="mt-1 text-[12.5px] text-muted">
                  De app houdt zelf bij of het gelukt is.
                </p>
              )}
            </div>
            {watcher ? null : (
              <Link
                href="/wheel/prizes"
                className="espresso flex h-[52px] w-full items-center justify-center rounded-full text-[15px] font-semibold"
              >
                Bekijk mijn challenge
              </Link>
            )}
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
