"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { GOLD } from "@/lib/super-badi";


/** Shared gradient so every gold part catches the light the same way. */
function GoldGradient({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={GOLD.light} />
        <stop offset="55%" stopColor={GOLD.mid} />
        <stop offset="100%" stopColor={GOLD.deep} />
      </linearGradient>
    </defs>
  );
}

/**
 * Small gold crown, tilted on the top right of a profile photo. The ring
 * itself is the gold progress ring of MemberAvatar; `outer` is the size of
 * the avatar box including that ring.
 */
export function SuperBadiCrown({ outer }: { outer: number }) {
  const id = useId().replace(/:/g, "");
  const w = Math.max(18, outer * 0.42);
  const h = w * 0.62;
  // Base of the crown rests on the outside of the ring at about one o'clock,
  // and it leans outward from there.
  const a = (-52 * Math.PI) / 180;
  const r = outer / 2;
  const x = outer / 2 + r * Math.cos(a);
  const y = outer / 2 + r * Math.sin(a);
  return (
    <svg
      width={w}
      height={h}
      viewBox="-1.5 -1.5 27 18"
      className="pointer-events-none absolute z-10 overflow-visible"
      style={{ left: x - w / 2, top: y - h, transform: "rotate(30deg)", transformOrigin: "50% 100%", filter: "drop-shadow(0 1px 2px rgba(95, 53, 41, 0.4))" }}
      aria-hidden
    >
      <GoldGradient id={id} />
      {/* White outline first, so the crown stands free from the photo and the ring. */}
      <g fill={`url(#${id})`} stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" paintOrder="stroke">
        <path d="M2 12 L3.4 4.6 Q6.6 9.2 9 6.2 L12 0.6 L15 6.2 Q17.4 9.2 20.6 4.6 L22 12 Z" />
        <rect x="2" y="12.3" width="20" height="2.6" rx="1" />
      </g>
    </svg>
  );
}

/** Dark ribbon with gold lettering, under the photo of the Super Badi. */
export function SuperBadiBanner({ className, size = "sm" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[6px] border bg-[#1d1310] font-semibold uppercase tracking-[0.16em] shadow-[0_0_10px_rgba(240,190,80,0.25)]",
        size === "md" ? "px-3 py-1 text-[11px]" : "px-2 py-[3px] text-[9px]",
        className,
      )}
      style={{ borderColor: GOLD.mid, color: GOLD.light }}
    >
      <span aria-hidden style={{ color: GOLD.mid }}>✦</span>
      Super Badi
    </span>
  );
}
