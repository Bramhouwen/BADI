"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { SPRITE_CELL, type SpriteAnim, type SpriteSheet } from "@/lib/sprites";
import { cn } from "@/lib/utils";

/**
 * One squad character from a sprite sheet, playing `anim`. `height` is the
 * drawn height in px; the width follows the cell ratio. With reduced motion
 * the first frame stays still.
 */
export function Sprite({ sheet, anim, height = 160, className, label }: { sheet: SpriteSheet; anim: SpriteAnim; height?: number; className?: string; label?: string }) {
  const reduce = useReducedMotion();
  const { frames, fps } = sheet.anims[anim];
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduce || frames.length < 2) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000 / fps);
    return () => clearInterval(id);
  }, [reduce, frames.length, fps]);

  const [row, col] = frames[tick % frames.length];
  const scale = height / SPRITE_CELL.h;
  const w = Math.round(SPRITE_CELL.w * scale);
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0 bg-no-repeat", className)}
      style={{
        width: w,
        height,
        backgroundImage: `url(${sheet.src})`,
        backgroundSize: `${Math.round(SPRITE_CELL.w * SPRITE_CELL.cols * scale)}px ${Math.round(SPRITE_CELL.h * SPRITE_CELL.rows * scale)}px`,
        backgroundPosition: `${-Math.round(col * SPRITE_CELL.w * scale)}px ${-Math.round(row * SPRITE_CELL.h * scale)}px`,
      }}
    />
  );
}
