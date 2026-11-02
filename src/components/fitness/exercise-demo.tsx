"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { motionFor } from "@/lib/exercise-motion/library";
import { ExerciseFigure } from "./exercise-figure";
import { cn } from "@/lib/utils";

/** Sheet with the moving figure and the how-to for one exercise. */
export function ExerciseDemoSheet({ name, subtitle, open, onClose }: { name: string; subtitle?: string; open: boolean; onClose: () => void }) {
  const motion = motionFor(name);
  if (!motion) return null;
  return (
    <Sheet open={open} onClose={onClose} title={name}>
      <div className="space-y-4 pb-2">
        {subtitle ? <p className="-mt-2 text-[12.5px] text-muted">{subtitle}</p> : null}
        <div className="rounded-[22px] bg-[#fbf3ec] ring-1 ring-ink/[0.05]">
          <ExerciseFigure motion={motion} label={`Uitvoering van ${name}`} className="mx-auto block h-[240px] w-full max-w-[300px]" />
        </div>
        <ol className="space-y-2">
          {motion.cues.map((c, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink">
                <span className="text-[11px] font-semibold text-paper">{i + 1}</span>
              </span>
              <span className="text-[14px] leading-snug text-text">{c}</span>
            </li>
          ))}
        </ol>
      </div>
    </Sheet>
  );
}

/** Small play button next to an exercise name; renders nothing for exercises without a demo. */
export function ExerciseDemoButton({ name, subtitle, className }: { name: string; subtitle?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!motionFor(name)) return null;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Bekijk uitvoering van ${name}`}
        className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fbf3ec] text-ink ring-1 ring-ink/[0.08] hover:bg-blush", className)}
      >
        <Play className="h-3.5 w-3.5 translate-x-[1px]" strokeWidth={2.2} fill="currentColor" />
      </button>
      <ExerciseDemoSheet name={name} subtitle={subtitle} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Still thumbnail of an exercise (start position with the end position faintly behind it). */
export function ExerciseThumb({ name, className }: { name: string; className?: string }) {
  const motion = motionFor(name);
  if (!motion) return null;
  return <ExerciseFigure motion={motion} animate={false} label={name} className={className} />;
}
