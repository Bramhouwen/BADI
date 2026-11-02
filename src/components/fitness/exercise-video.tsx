"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import type { ExerciseMedia } from "@/lib/exercise-video";
import { cn } from "@/lib/utils";

/**
 * Looping, muted demo clip that only plays while on screen. With "reduce motion"
 * on it stays on the poster and shows the native controls instead.
 */
export function ExerciseVideo({ media, label, className }: { media: ExerciseMedia; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce, media.video]);

  return (
    <video
      ref={ref}
      key={media.video}
      src={media.video}
      poster={media.poster}
      muted
      loop
      playsInline
      preload="metadata"
      controls={Boolean(reduce)}
      aria-label={label}
      className={cn("block bg-[#efe3d6] object-cover", className)}
    />
  );
}
