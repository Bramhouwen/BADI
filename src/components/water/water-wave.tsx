"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * A container that fills from the bottom with an animated wave.
 * `level` is 0..1. Children render on top of the water.
 */
export function WaterWave({ level, className, children, tint = "var(--water)" }: { level: number; className?: string; children?: React.ReactNode; tint?: string }) {
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(1, level));
  return (
    <div className={cn("relative overflow-hidden", className)} aria-hidden>
      <motion.div
        className="absolute inset-x-0 bottom-0"
        initial={false}
        animate={{ height: `${pct * 100}%` }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 18 }}
        style={{ minHeight: pct > 0 ? 18 : 0 }}
      >
        <svg className="wave absolute -top-[14px] left-0 h-[16px] w-[200%]" viewBox="0 0 1200 16" preserveAspectRatio="none">
          <path d="M0 8 C 150 0, 300 16, 450 8 S 750 0, 900 8 S 1050 16, 1200 8 L1200 16 L0 16 Z" fill={tint} fillOpacity="0.55" />
        </svg>
        <svg className="wave-slow absolute -top-[10px] left-0 h-[12px] w-[200%]" viewBox="0 0 1200 12" preserveAspectRatio="none">
          <path d="M0 6 C 150 12, 300 0, 450 6 S 750 12, 900 6 S 1050 0, 1200 6 L1200 12 L0 12 Z" fill={tint} />
        </svg>
        <div className="h-full w-full" style={{ background: `linear-gradient(180deg, ${tint} 0%, var(--water-deep) 100%)` }} />
        {!reduce ? (
          <>
            <span className="absolute bottom-3 left-[22%] h-2 w-2 rounded-full bg-white/50 animate-[bubble_4s_ease-in_infinite]" />
            <span className="absolute bottom-6 left-[64%] h-1.5 w-1.5 rounded-full bg-white/40 animate-[bubble_5s_ease-in_infinite_1s]" />
          </>
        ) : null}
      </motion.div>
      <div className="relative">{children}</div>
      <style>{`@keyframes bubble { 0% { transform: translateY(0); opacity: 0 } 20% { opacity: .9 } 100% { transform: translateY(-140px); opacity: 0 } }`}</style>
    </div>
  );
}
