"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { muscleLabel, setLabel, type ExerciseMeasure } from "@/lib/fitness";
import { exerciseMedia } from "@/lib/exercise-video";
import { motionFor } from "@/lib/exercise-motion/library";
import type { DraftSet } from "@/app/actions/fitness";
import { ExerciseThumb } from "./exercise-demo";
import { ExerciseFigure } from "./exercise-figure";
import { ExerciseVideo } from "./exercise-video";
import { HoldTimer } from "./hold-timer";
import { cn } from "@/lib/utils";

export interface PlayerExercise {
  key: string;
  name: string;
  muscle_group: string;
  measure: ExerciseMeasure;
  sets: DraftSet[];
}

/**
 * One exercise at a time during a live workout: the demo large, the sets as pills
 * to tick off, and the next exercise below. Weights and reps are edited in the list view.
 */
export function WorkoutPlayer({
  items,
  index,
  onIndex,
  onToggle,
  onEdit,
  onHold,
  previous,
}: {
  items: PlayerExercise[];
  index: number;
  onIndex: (i: number) => void;
  onToggle: (exercise: number, set: number) => void;
  onEdit: () => void;
  /** Timed exercises: the hold timer finished a set with this many seconds held. */
  onHold?: (exercise: number, set: number, seconds: number) => void;
  previous?: string;
}) {
  const reduce = useReducedMotion();
  // Only animate when switching exercises; the exercise shown first (also server-side) appears straight away.
  const [firstKey] = useState(() => items[index]?.key);
  const ex = items[index];
  if (!ex) return null;
  const next = items[index + 1];
  const media = exerciseMedia(ex.name);
  const figure = media ? null : motionFor(ex.name);
  const open = ex.sets.findIndex((s) => !s.completed);
  const done = ex.sets.length > 0 && open === -1;

  function primary() {
    if (open >= 0) onToggle(index, open);
    else if (next) onIndex(index + 1);
  }

  return (
    <motion.section key={ex.key} initial={reduce || ex.key === firstKey ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-4" aria-label={ex.name}>
      <div className="relative overflow-hidden rounded-[24px] bg-[#fbf3ec] ring-1 ring-ink/[0.05]">
        {media ? (
          <ExerciseVideo media={media} label={`Uitvoering van ${ex.name}`} className="aspect-square w-full" />
        ) : figure ? (
          <ExerciseFigure motion={figure} label={`Uitvoering van ${ex.name}`} className="mx-auto block aspect-square w-full max-w-[340px]" />
        ) : (
          <div className="aspect-[2/1] w-full" />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 shadow-sm backdrop-blur">
          <span className="text-[11.5px] font-semibold tabular-nums text-ink">
            {index + 1} / {items.length}
          </span>
        </span>
      </div>

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[26px] leading-[1.1] text-text">{ex.name}</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            {muscleLabel(ex.muscle_group)}
            {previous ? ` · vorige keer: ${previous}` : ""}
          </p>
        </div>
        <button type="button" onClick={() => onIndex(index - 1)} disabled={index === 0} className="soft flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-30" aria-label="Vorige oefening">
          <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
        </button>
        <button type="button" onClick={() => onIndex(index + 1)} disabled={!next} className="soft flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-30" aria-label="Volgende oefening">
          <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>

      {ex.sets.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Sets">
          {ex.sets.map((s, n) => (
            <li key={n}>
              <motion.button
                type="button"
                aria-pressed={s.completed}
                aria-label={`Set ${n + 1}: ${setLabel(s, ex.measure)}${s.completed ? ", voltooid" : ""}`}
                whileTap={reduce ? undefined : { scale: 0.94 }}
                onClick={() => onToggle(index, n)}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-full border pl-2 pr-3.5 transition",
                  s.completed ? "border-sage bg-sage text-white" : n === open ? "border-ink/25 bg-white text-ink shadow-sm" : "border-ink/10 bg-white/70 text-ink",
                )}
              >
                {/* Buttons inherit color from globals.css, so the colors sit on the spans. */}
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", s.completed ? "bg-white/25 text-white" : "bg-[#fbf3ec] text-ink")}>
                  {s.completed ? <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> : <span className="text-[11.5px] font-semibold tabular-nums">{n + 1}</span>}
                </span>
                <span className={cn("text-[13.5px] font-medium tabular-nums", s.completed ? "text-white" : "text-ink")}>{setLabel(s, ex.measure)}</span>
              </motion.button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">Nog geen sets voor deze oefening.</p>
      )}

      {ex.measure === "time" && open >= 0 && onHold ? (
        <HoldTimer key={`${ex.key}-${open}`} setNumber={open + 1} target={ex.sets[open].duration_seconds} onDone={(seconds) => onHold(index, open, seconds)} onEdit={onEdit} />
      ) : (
      <div className="flex items-center gap-2">
        <button type="button" onClick={primary} disabled={done && !next} className="espresso flex h-12 flex-1 items-center justify-center gap-2 rounded-full shadow-none disabled:opacity-50">
          <span className="text-[14.5px] font-medium text-paper">{open >= 0 ? `Set ${open + 1} afvinken` : next ? "Volgende oefening" : "Alle sets klaar"}</span>
        </button>
        <button type="button" onClick={onEdit} className="flex h-12 items-center rounded-full border border-ink/10 bg-white px-4 shadow-sm hover:bg-blush">
          <span className="text-[13px] font-medium text-ink">Aanpassen</span>
        </button>
      </div>
      )}

      {next ? (
        <button type="button" onClick={() => onIndex(index + 1)} className="glass flex w-full items-center gap-3 rounded-[18px] p-2 pr-3 text-left hover:bg-blush/40">
          <span className="block h-[56px] w-[56px] shrink-0 overflow-hidden rounded-[13px] bg-[#fbf3ec]">
            <ExerciseThumb name={next.name} className="block h-full w-full" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted">Hierna</span>
            <span className="block truncate text-[14.5px] font-medium text-text">{next.name}</span>
            <span className="block truncate text-[11.5px] text-muted">
              {next.sets.length} {next.sets.length === 1 ? "set" : "sets"}
              {next.sets[0] ? ` · ${setLabel(next.sets[0], next.measure)}` : ""}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.6} />
        </button>
      ) : null}
    </motion.section>
  );
}
