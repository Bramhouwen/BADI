"use client";

import { useState } from "react";
import { useReducedMotion } from "motion/react";

const COLORS = ["#d2b27a", "#8c9e7a", "#7fa3bd", "#cf9a7c", "#6e4034", "#efdfd4"];

/** A short burst of falling paper; nothing with reduced motion. */
export function Confetti({ pieces = 70, colors = COLORS }: { pieces?: number; colors?: string[] }) {
  const reduce = useReducedMotion();
  const [bits] = useState(() =>
    Array.from({ length: pieces }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.8 + Math.random() * 1.4,
      drift: (Math.random() - 0.5) * 160,
      spin: (Math.random() - 0.5) * 900,
      color: colors[i % colors.length],
      w: 6 + Math.random() * 5,
      h: 9 + Math.random() * 7,
    })),
  );
  if (reduce) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti-bit absolute top-[-20px] rounded-[2px]"
          style={
            {
              left: `${b.left}%`,
              width: b.w,
              height: b.h,
              background: b.color,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`,
              "--drift": `${b.drift}px`,
              "--spin": `${b.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
