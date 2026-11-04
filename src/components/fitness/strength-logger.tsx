"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ExerciseDemoButton } from "./exercise-demo";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorText, Input, Label, Textarea } from "@/components/ui/field";
import { DecimalInput } from "./decimal-input";
import { DurationInput } from "./duration-input";
import { useToast } from "@/components/ui/toast";
import { formatDuration, formatVolume, muscleLabel, sessionVolumeKg, setLabel, timerElapsed, type ExerciseMeasure, type TimerState } from "@/lib/fitness";
import type { ExerciseRow, LastPerformance, SessionDetail } from "@/lib/fitness/data";
import { finishStrengthSession, saveStrengthDraft, type DraftExercise, type DraftSet, type StrengthDraft } from "@/app/actions/fitness";
import { ExercisePicker } from "./exercise-picker";
import { WorkoutPlayer } from "./workout-player";
import { DiscardDraftButton } from "./session-actions";
import { ChipTabs } from "@/components/ui/page";
import { cn } from "@/lib/utils";
import { useMounted } from "@/lib/use-mounted";

interface LocalExercise extends DraftExercise {
  key: string;
  name: string;
  muscle_group: string;
  measure: ExerciseMeasure;
}

const EMPTY_SET: DraftSet = { weight_kg: null, repetitions: null, duration_seconds: null, completed: false };

function toLocal(session: SessionDetail): LocalExercise[] {
  return session.exercises.map((e) => ({
    key: e.id,
    exercise_id: e.exercise_id,
    name: e.name,
    muscle_group: e.muscle_group,
    measure: e.measure,
    notes: e.notes ?? "",
    sets: e.sets.map((s) => ({ weight_kg: s.weight_kg, repetitions: s.repetitions, duration_seconds: s.duration_seconds, completed: s.completed })),
  }));
}

/** Logging afterwards: a set counts as done as soon as it has a weight, a number of reps or a time. */
function filled(s: DraftSet): boolean {
  return s.weight_kg !== null || s.repetitions !== null || s.duration_seconds !== null;
}

/**
 * draft: live workout with a running timer and per-set ticks.
 * after: logging a finished workout; duration is typed in and filled sets count as done.
 * edit: changing a saved workout; duration is typed in.
 */
export function StrengthLogger({ session, exercises, last, today, mode }: { session: SessionDetail; exercises: ExerciseRow[]; last: LastPerformance; today: string; mode: "draft" | "after" | "edit" }) {
  const [title, setTitle] = useState(session.title);
  const [date, setDate] = useState(session.workout_date);
  const [notes, setNotes] = useState(session.notes ?? "");
  const [items, setItems] = useState<LocalExercise[]>(() => toLocal(session));
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirty = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const toast = useToast();
  const reduce = useReducedMotion();
  // A live workout opens on one exercise at a time; the list stays one tap away for editing.
  const [view, setView] = useState<"player" | "list">(mode === "draft" && session.exercises.length > 0 ? "player" : "list");
  const [current, setCurrent] = useState(() => {
    const i = session.exercises.findIndex((e) => e.sets.some((x) => !x.completed));
    return i < 0 ? 0 : i;
  });

  const timerKey = `badi:strength-timer:${session.id}`;
  // Timestamp-based timer: the start moment is persisted so a reload or background tab keeps counting correctly.
  const [timer] = useState<TimerState>(() => {
    const fallback: TimerState = { startedAt: mode === "draft" ? Date.parse(session.started_at ?? "") || Date.now() : null, accumulated: 0 };
    if (mode !== "draft" || typeof window === "undefined") return fallback;
    try {
      const raw = localStorage.getItem(timerKey);
      if (raw) return JSON.parse(raw) as TimerState;
      localStorage.setItem(timerKey, JSON.stringify(fallback));
    } catch {}
    return fallback;
  });
  const live = mode === "draft";
  const after = mode === "after";
  const [hours, setHours] = useState(() => Math.floor((session.duration_seconds ?? 0) / 3600));
  const [minutes, setMinutes] = useState(() => Math.floor(((session.duration_seconds ?? 0) % 3600) / 60));
  const typedSeconds = hours * 3600 + minutes * 60;

  const draft = (): StrengthDraft => ({
    title,
    workout_date: date,
    notes,
    exercises: items.map(({ exercise_id, notes, sets }) => ({ exercise_id, notes, sets: after ? sets.map((x) => ({ ...x, completed: filled(x) })) : sets })),
    ...(live ? {} : { duration_seconds: typedSeconds }),
  });

  // Autosave the draft a moment after the last change so navigation never loses work.
  useEffect(() => {
    if (!dirty.current || mode === "edit") return;
    const t = setTimeout(() => {
      start(async () => {
        const r = await saveStrengthDraft(session.id, draft());
        if (r.ok) setSavedAt(Date.now());
      });
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, date, notes, items, hours, minutes]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty.current && savedAt === null) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [savedAt]);

  function mark() {
    dirty.current = true;
    setIsDirty(true);
    setSavedAt(null);
  }

  function addExercise(e: ExerciseRow) {
    const prev = last[e.id];
    const sets = prev ? prev.sets.map((s) => ({ ...s, completed: false })) : [EMPTY_SET];
    setItems((l) => {
      if (view === "player") setCurrent(l.length);
      return [...l, { key: `${e.id}-${Date.now()}`, exercise_id: e.id, name: e.name, muscle_group: e.muscle_group, measure: e.measure, notes: "", sets }];
    });
    mark();
  }

  function update(i: number, patch: Partial<LocalExercise>) {
    setItems((l) => l.map((x, k) => (k === i ? { ...x, ...patch } : x)));
    mark();
  }

  function toggleSet(i: number, n: number) {
    setItems((l) => l.map((x, k) => (k === i ? { ...x, sets: x.sets.map((y, m) => (m === n ? { ...y, completed: !y.completed } : y)) } : x)));
    mark();
  }

  const prevLabel = (exerciseId: string, measure: ExerciseMeasure) => {
    const prev = last[exerciseId];
    return prev ? prev.sets.map((s) => setLabel(s, measure)).join(", ") : undefined;
  };

  function move(i: number, dir: -1 | 1) {
    setItems((l) => {
      const j = i + dir;
      if (j < 0 || j >= l.length) return l;
      const copy = [...l];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
    mark();
  }

  const doneSets = useMemo(() => items.flatMap((e) => (after ? e.sets.map((x) => ({ ...x, completed: filled(x) })) : e.sets)), [items, after]);
  const volume = useMemo(() => sessionVolumeKg(doneSets), [doneSets]);
  const completedSets = doneSets.filter((s) => s.completed).length;

  function finish() {
    setError(null);
    if (after) {
      if (typedSeconds === 0 && completedSets === 0) return setError("Vul je duur of minimaal één set in.");
    } else {
      if (items.length === 0) return setError("Voeg minimaal één oefening toe.");
      if (completedSets === 0) return setError("Markeer minimaal één set als voltooid.");
    }
    start(async () => {
      const r = await finishStrengthSession(session.id, draft(), live ? timerElapsed(timer) : typedSeconds);
      if (r && !r.ok) setError(r.error);
      else {
        dirty.current = false;
        try {
          localStorage.removeItem(timerKey);
        } catch {}
      }
    });
  }

  function saveEdit() {
    setError(null);
    start(async () => {
      const r = await finishStrengthSession(session.id, draft(), typedSeconds);
      if (r && !r.ok) setError(r.error);
      else toast("Training opgeslagen", "success");
    });
  }

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between gap-3 p-3.5">
        {live ? (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Bezig</p>
            <LiveClock timer={timer} />
          </div>
        ) : (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Duur</p>
            <div className="mt-1 flex items-center gap-1.5">
              <Input type="number" inputMode="numeric" min={0} max={23} value={hours || ""} placeholder="0" aria-label="Uren" className="h-10 w-14 rounded-[12px] px-2 py-0 text-center" onChange={(e) => { setHours(Math.max(0, Math.min(23, Math.round(Number(e.target.value)) || 0))); mark(); }} />
              <span className="text-[12px] text-muted">uur</span>
              <Input type="number" inputMode="numeric" min={0} max={59} value={minutes || ""} placeholder="0" aria-label="Minuten" className="h-10 w-14 rounded-[12px] px-2 py-0 text-center" onChange={(e) => { setMinutes(Math.max(0, Math.min(59, Math.round(Number(e.target.value)) || 0))); mark(); }} />
              <span className="text-[12px] text-muted">min</span>
            </div>
          </div>
        )}
        <div className="text-right text-[12px] text-muted">
          <p>
            <span className="font-medium text-text">{completedSets}</span> sets voltooid
          </p>
          <p>
            Volume <span className="font-medium text-text">{formatVolume(volume)}</span>
          </p>
        </div>
      </Card>

      {live && items.length > 0 ? (
        <ChipTabs
          label="Weergave"
          value={view}
          onChange={setView}
          options={[
            { key: "player", label: "Per oefening" },
            { key: "list", label: "Alle oefeningen" },
          ]}
        />
      ) : null}

      {live && view === "player" && items.length > 0 ? (
        <WorkoutPlayer
          items={items}
          index={Math.min(current, items.length - 1)}
          onIndex={(i) => setCurrent(Math.max(0, Math.min(items.length - 1, i)))}
          onToggle={toggleSet}
          onEdit={() => setView("list")}
          onHold={(ei, n, seconds) => {
            setItems((l) => l.map((x, k) => (k === ei ? { ...x, sets: x.sets.map((y, m) => (m === n ? { ...y, duration_seconds: seconds, completed: true } : y)) } : x)));
            mark();
          }}
          previous={prevLabel(items[Math.min(current, items.length - 1)].exercise_id, items[Math.min(current, items.length - 1)].measure)}
        />
      ) : (
      <>
      <div className="grid grid-cols-[1fr_156px] gap-3">
        <div>
          <Label htmlFor="title">Naam</Label>
          <Input id="title" value={title} onChange={(e) => { setTitle(e.target.value); mark(); }} maxLength={80} />
        </div>
        <div>
          <Label htmlFor="date">Datum</Label>
          <Input id="date" type="date" value={date} max={today} onChange={(e) => { setDate(e.target.value); mark(); }} className="w-[150px]" />
        </div>
      </div>

      <ol className="space-y-3">
        {items.map((ex, i) => {
          const prev = last[ex.exercise_id];
          return (
            <li key={ex.key} className="glass rounded-[20px] p-3.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-text">{ex.name}</p>
                  <p className="text-[11px] text-muted">
                    {muscleLabel(ex.muscle_group)}
                    {prev ? ` · vorige keer: ${prevLabel(ex.exercise_id, ex.measure)}` : ""}
                  </p>
                </div>
                <ExerciseDemoButton name={ex.name} subtitle={muscleLabel(ex.muscle_group)} />
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="soft flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30" aria-label="Omhoog">
                  <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.7} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="soft flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30" aria-label="Omlaag">
                  <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.7} />
                </button>
                <button type="button" onClick={() => { setItems((l) => l.filter((_, k) => k !== i)); mark(); }} className="soft flex h-8 w-8 items-center justify-center rounded-full hover:text-danger" aria-label="Oefening verwijderen">
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                </button>
              </div>

              <div className={cn("mt-3 grid items-center gap-2 px-1 text-[10.5px] font-medium uppercase tracking-wide text-muted", setGrid(ex.measure, after))}>
                <span>Set</span>
                {ex.measure === "time" ? <span>Tijd</span> : (
                  <>
                    <span>kg</span>
                    <span>Herh.</span>
                  </>
                )}
                {after ? null : <span className="text-center">Klaar</span>}
              </div>
              <div className="mt-1 space-y-1.5">
                {ex.sets.map((s, n) => (
                  <div key={n} className={cn("grid items-center gap-2 rounded-[14px] px-1 py-1", setGrid(ex.measure, after), !after && s.completed && "bg-sage/15")}>
                    <span className="text-center text-[13px] font-medium text-muted">{n + 1}</span>
                    {ex.measure === "time" ? (
                      <DurationInput
                        value={s.duration_seconds}
                        label={`Tijd set ${n + 1}`}
                        onValue={(num) => update(i, { sets: ex.sets.map((x, k) => (k === n ? { ...x, duration_seconds: num } : x)) })}
                      />
                    ) : (
                      <>
                        <DecimalInput
                          value={s.weight_kg}
                          placeholder="–"
                          aria-label={`Gewicht set ${n + 1}`}
                          className="h-10 rounded-[12px] px-3 py-0 text-center"
                          onValue={(num) => update(i, { sets: ex.sets.map((x, k) => (k === n ? { ...x, weight_kg: num } : x)) })}
                        />
                        <WholeInput
                          value={s.repetitions}
                          max={1000}
                          label={`Herhalingen set ${n + 1}`}
                          onValue={(num) => update(i, { sets: ex.sets.map((x, k) => (k === n ? { ...x, repetitions: num } : x)) })}
                        />
                      </>
                    )}
                    {after ? null : (
                    <div className="flex items-center justify-center gap-1">
                      <motion.button
                        type="button"
                        aria-pressed={s.completed}
                        aria-label={`Set ${n + 1} voltooid`}
                        whileTap={reduce ? undefined : { scale: 0.85 }}
                        onClick={() => update(i, { sets: ex.sets.map((x, k) => (k === n ? { ...x, completed: !x.completed } : x)) })}
                        className={cn("flex h-9 w-9 items-center justify-center rounded-full border transition", s.completed ? "border-sage bg-sage text-white" : "border-ink/15 bg-white text-muted")}
                      >
                        <Check className="h-4 w-4" strokeWidth={2.2} />
                      </motion.button>
                    </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={() => update(i, { sets: [...ex.sets, { ...(ex.sets[ex.sets.length - 1] ?? EMPTY_SET), completed: false }] })} className="soft flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium">
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.8} /> Set
                </button>
                {ex.sets.length > 0 ? (
                  <button type="button" onClick={() => update(i, { sets: ex.sets.slice(0, -1) })} className="flex h-9 items-center rounded-full px-3 text-[12px] text-muted hover:text-danger">
                    Laatste set weg
                  </button>
                ) : null}
              </div>
              <Input value={ex.notes} onChange={(e) => update(i, { notes: e.target.value })} maxLength={300} placeholder="Notitie bij deze oefening (optioneel)" className="mt-2 h-10 rounded-[12px] px-3.5 py-0 text-[13px]" aria-label="Notitie" />
            </li>
          );
        })}
      </ol>

      </>
      )}

      <Button variant="secondary" className="w-full" onClick={() => setPicker(true)}>
        <Plus className="h-4 w-4" strokeWidth={1.8} /> Oefening toevoegen
      </Button>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} exercises={exercises} onPick={addExercise} />

      <div>
        <Label htmlFor="notes">Opmerkingen (optioneel)</Label>
        <Textarea id="notes" value={notes} onChange={(e) => { setNotes(e.target.value); mark(); }} maxLength={1000} className="min-h-[64px]" />
      </div>

      <ErrorText>{error}</ErrorText>
      {mode !== "edit" ? (
        <>
          <Button size="lg" className="w-full" onClick={finish} loading={pending}>
            {after ? "Training opslaan" : "Training afronden"}
          </Button>
          <p className="text-center text-[11px] text-muted">{savedAt ? "Concept automatisch opgeslagen." : isDirty ? "Wijzigingen worden opgeslagen…" : "Je concept wordt automatisch bewaard."}</p>
          <DiscardDraftButton
            id={session.id}
            variant="text"
            className="pt-2"
            onDone={() => {
              dirty.current = false;
              try {
                localStorage.removeItem(timerKey);
              } catch {}
            }}
          />
        </>
      ) : (
        <Button size="lg" className="w-full" onClick={saveEdit} loading={pending}>
          Wijzigingen opslaan
        </Button>
      )}
    </div>
  );
}

/** Grid of a set row: set number, the inputs (seconds, or kg and reps) and the tick when live. */
function setGrid(measure: ExerciseMeasure, after: boolean): string {
  if (measure === "time") return after ? "grid-cols-[32px_1fr]" : "grid-cols-[32px_1fr_40px]";
  return after ? "grid-cols-[32px_1fr_1fr]" : "grid-cols-[32px_1fr_1fr_40px]";
}

/** Whole numbers only (reps, seconds); empty means not filled in. */
function WholeInput({ value, max, label, onValue }: { value: number | null; max: number; label: string; onValue: (v: number | null) => void }) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      value={value ?? ""}
      placeholder="–"
      aria-label={label}
      className="h-10 rounded-[12px] px-3 py-0 text-center"
      onChange={(e) => {
        const v = e.target.value;
        const num = v === "" ? null : Math.max(0, Math.min(max, Math.round(Number(v))));
        onValue(num === null || Number.isNaN(num) ? null : num);
      }}
    />
  );
}

/**
 * The running workout clock. It ticks on its own, so the rest of the logger
 * (the exercise list) does not redraw every second while you scroll.
 */
function LiveClock({ timer }: { timer: TimerState }) {
  const mounted = useMounted();
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  // The live clock only exists in the browser; the server and hydration pass show 0 so the HTML matches.
  const shown = mounted ? timerElapsed(timer) : 0;
  return <p className="font-display text-[28px] leading-none tabular-nums text-text">{formatDuration(shown) === "–" ? "0s" : formatDuration(shown)}</p>;
}
