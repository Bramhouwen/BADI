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
 * Gold frame around a profile photo: a full gold ring, a crown on top and a
 * laurel branch on either side. Drawn over the photo; `outer` is the size of
 * the avatar box including its ring.
 */
export function SuperBadiFrame({ outer }: { outer: number }) {
  const id = useId().replace(/:/g, "");
  const c = outer / 2;
  const ring = c - 1.75;
  // Laurel: a stem just outside the ring from the bottom up the left side,
  // leaves pointing up along it; the right branch is its mirror image.
  const stemR = c + outer * 0.09;
  const angles = [112, 128, 144, 160, 176, 192];
  const L = outer * 0.17;
  const W = outer * 0.05;
  const leafPath = `M0 0 Q${L / 2} ${-W} ${L} 0 Q${L / 2} ${W} 0 0Z`;
  const point = (deg: number): [number, number] => [c + stemR * Math.cos((deg * Math.PI) / 180), c + stemR * Math.sin((deg * Math.PI) / 180)];
  const [sx, sy] = point(104);
  const [ex, ey] = point(200);
  const branch = (
    <>
      <path d={`M${sx} ${sy} A${stemR} ${stemR} 0 0 1 ${ex} ${ey}`} fill="none" stroke={`url(#${id})`} strokeWidth={Math.max(1, outer * 0.015)} strokeLinecap="round" />
      {angles.map((deg, i) => {
        const [x, y] = point(deg);
        const along = deg + 90; // direction the branch grows (upward)
        const scale = 1 - i * 0.06;
        return (
          <g key={deg}>
            <path d={leafPath} fill={`url(#${id})`} transform={`translate(${x} ${y}) rotate(${along - 38}) scale(${scale})`} />
            <path d={leafPath} fill={`url(#${id})`} transform={`translate(${x} ${y}) rotate(${along + 30}) scale(${scale * 0.72})`} />
          </g>
        );
      })}
    </>
  );
  const crownW = outer * 0.42;
  const crownH = crownW * 0.62;
  return (
    <svg
      width={outer}
      height={outer}
      viewBox={`0 0 ${outer} ${outer}`}
      className="pointer-events-none absolute inset-0 overflow-visible"
      style={{ filter: "drop-shadow(0 0 5px rgba(240, 190, 80, 0.55))" }}
      aria-hidden
    >
      <GoldGradient id={id} />
      <circle cx={c} cy={c} r={ring} fill="none" stroke={`url(#${id})`} strokeWidth={3.5} />
      {branch}
      <g transform={`translate(${outer} 0) scale(-1 1)`}>{branch}</g>
      <g transform={`translate(${c - crownW / 2} ${-crownH * 0.72}) scale(${crownW / 24} ${crownH / 15})`}>
        <path d="M2 12 L3.4 4.6 Q6.6 9.2 9 6.2 L12 0.6 L15 6.2 Q17.4 9.2 20.6 4.6 L22 12 Z" fill={`url(#${id})`} />
        <rect x="2" y="12.3" width="20" height="2.4" rx="1" fill={`url(#${id})`} />
        <circle cx="12" cy="0.9" r="0.9" fill={GOLD.light} />
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
