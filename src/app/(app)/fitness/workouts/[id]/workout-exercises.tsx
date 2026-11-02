"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { ExerciseDemoSheet, ExerciseThumb, hasDemo } from "@/components/fitness/exercise-demo";

export interface WorkoutExerciseItem {
  id: string;
  name: string;
  muscle: string;
  target: string;
}

/** The exercises of a workout with a still of each; tap one to watch the demo. */
export function WorkoutExercises({ items }: { items: WorkoutExerciseItem[] }) {
  const [open, setOpen] = useState<WorkoutExerciseItem | null>(null);
  return (
    <>
      <ol className="space-y-2">
        {items.map((e, i) => {
          const demo = hasDemo(e.name);
          const body = (
            <>
              <span className="relative block h-[64px] w-[64px] shrink-0 overflow-hidden rounded-[14px] bg-[#fbf3ec]">
                {demo ? <ExerciseThumb name={e.name} className="block h-full w-full" /> : null}
                <span className="absolute left-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white/90 px-1">
                  <span className="text-[10.5px] font-semibold tabular-nums text-ink">{i + 1}</span>
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium text-text">{e.name}</span>
                <span className="block truncate text-[12px] text-muted">
                  {e.target} · {e.muscle}
                </span>
              </span>
              {demo ? <ChevronRight className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.6} /> : null}
            </>
          );
          return (
            <li key={e.id}>
              {demo ? (
                <button type="button" onClick={() => setOpen(e)} className="glass flex w-full items-center gap-3 rounded-[18px] p-2 pr-3 text-left hover:bg-blush/40" aria-label={`Bekijk uitvoering van ${e.name}`}>
                  {body}
                </button>
              ) : (
                <div className="glass flex items-center gap-3 rounded-[18px] p-2 pr-3">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
      <ExerciseDemoSheet name={open?.name ?? ""} subtitle={open ? `${open.target} · ${open.muscle}` : undefined} open={Boolean(open)} onClose={() => setOpen(null)} />
    </>
  );
}
