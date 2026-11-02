"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorText, Hint, Input, Label, Textarea } from "@/components/ui/field";
import { IconBadge } from "@/components/ui/icon-badge";
import { activityMeta, formatDuration, formatPace, formatSpeed, paceSecPerKm, speedKmh, timerElapsed, type ActivityType, type TimerState } from "@/lib/fitness";
import { createCardioSession, updateCardioSession } from "@/app/actions/fitness";
import type { ActionResult } from "@/lib/types";
import { useMounted } from "@/lib/use-mounted";

export interface CardioInitial {
  title?: string;
  workout_date?: string;
  start_time?: string;
  duration_seconds?: number | null;
  distance_meters?: number | null;
  notes?: string | null;
}

const DRAFT_KEY = "badi:cardio-timer";

function split(seconds: number) {
  return { h: Math.floor(seconds / 3600), m: Math.floor((seconds % 3600) / 60), s: seconds % 60 };
}

export function CardioForm({ type, today, initial, sessionId }: { type: ActivityType; today: string; initial?: CardioInitial; sessionId?: string }) {
  const meta = activityMeta(type);
  const init = split(initial?.duration_seconds ?? 0);
  const [hours, setHours] = useState(init.h);
  const [minutes, setMinutes] = useState(init.m);
  const [seconds, setSeconds] = useState(init.s);
  const [distanceKm, setDistanceKm] = useState(initial?.distance_meters ? String(initial.distance_meters / 1000) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  // Timestamp-based timer: survives background tabs and reloads via localStorage.
  const [timer, setTimer] = useState<TimerState>(() => {
    if (sessionId || typeof window === "undefined") return { startedAt: null, accumulated: 0 };
    try {
      const raw = localStorage.getItem(`${DRAFT_KEY}:${type}`);
      if (raw) return JSON.parse(raw) as TimerState;
    } catch {}
    return { startedAt: null, accumulated: 0 };
  });
  const [tick, setTick] = useState(0);
  const loaded = useRef(true);
  useEffect(() => {
    if (!loaded.current || sessionId) return;
    try {
      if (timer.startedAt === null && timer.accumulated === 0) localStorage.removeItem(`${DRAFT_KEY}:${type}`);
      else localStorage.setItem(`${DRAFT_KEY}:${type}`, JSON.stringify(timer));
    } catch {}
  }, [timer, type, sessionId]);
  useEffect(() => {
    if (!timer.startedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timer.startedAt]);
  void tick;
  const mounted = useMounted();
  // The persisted timer only exists in the browser; until mounted we render the idle state the server rendered.
  const view: TimerState = mounted ? timer : { startedAt: null, accumulated: 0 };
  const elapsed = timerElapsed(view);
  const running = view.startedAt !== null;

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  function applyTimer() {
    const sp = split(elapsed);
    setHours(sp.h);
    setMinutes(sp.m);
    setSeconds(sp.s);
    setTimer({ startedAt: null, accumulated: 0 });
    setDirty(true);
  }

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  const meters = Math.round((Number(distanceKm.replace(",", ".")) || 0) * 1000);
  const preview = useMemo(() => {
    if (type === "cycle") return formatSpeed(speedKmh(meters, totalSeconds));
    if (type === "run" || type === "walk") return formatPace(paceSecPerKm(meters, totalSeconds));
    return null;
  }, [type, meters, totalSeconds]);

  function submit(fd: FormData) {
    setError(null);
    fd.set("distance_km", distanceKm.replace(",", "."));
    start(async () => {
      const r: ActionResult = sessionId ? await updateCardioSession(sessionId, fd) : await createCardioSession(fd);
      if (r && !r.ok) setError(r.error);
      else {
        setDirty(false);
        try {
          localStorage.removeItem(`${DRAFT_KEY}:${type}`);
        } catch {}
      }
    });
  }

  return (
    <form action={submit} className="space-y-4" onChange={() => setDirty(true)}>
      <input type="hidden" name="activity_type" value={type} />
      <div className="flex items-center gap-3 px-0.5">
        <IconBadge icon={meta.icon} size="md" />
        <div>
          <p className="font-display text-[20px] leading-tight text-text">{meta.label}</p>
          <p className="text-[12px] text-muted">{meta.hint}</p>
        </div>
      </div>

      {!sessionId ? (
        <Card className="flex items-center justify-between gap-3 p-3.5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Timer</p>
            <p className="font-display text-[30px] leading-none tabular-nums text-text">{formatDuration(elapsed) === "–" ? "0s" : formatDuration(elapsed)}</p>
          </div>
          <div className="flex items-center gap-2">
            {running ? (
              <Button type="button" variant="secondary" size="icon" aria-label="Pauzeren" onClick={() => setTimer({ startedAt: null, accumulated: elapsed })}>
                <Pause className="h-5 w-5" strokeWidth={1.7} />
              </Button>
            ) : (
              <Button type="button" variant="secondary" size="icon" aria-label={elapsed > 0 ? "Hervatten" : "Starten"} onClick={() => setTimer({ startedAt: Date.now(), accumulated: timer.accumulated })}>
                <Play className="h-5 w-5" strokeWidth={1.7} />
              </Button>
            )}
            <Button type="button" variant="dark" size="icon" aria-label="Stoppen en duur overnemen" disabled={elapsed === 0} onClick={applyTimer}>
              <Square className="h-4 w-4" strokeWidth={1.8} />
            </Button>
          </div>
        </Card>
      ) : null}

      <div>
        <Label htmlFor="title">Naam</Label>
        <Input id="title" name="title" defaultValue={initial?.title ?? meta.label} maxLength={80} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="workout_date">Datum</Label>
          <Input id="workout_date" name="workout_date" type="date" defaultValue={initial?.workout_date ?? today} max={today} required />
        </div>
        <div>
          <Label htmlFor="start_time">Starttijd (optioneel)</Label>
          <Input id="start_time" name="start_time" type="time" defaultValue={initial?.start_time ?? ""} />
        </div>
      </div>
      <div>
        <Label>Duur</Label>
        <div className="grid grid-cols-3 gap-2">
          <Input name="hours" type="number" inputMode="numeric" min={0} max={23} value={hours} onChange={(e) => setHours(Math.max(0, Math.min(23, Number(e.target.value) || 0)))} aria-label="Uren" />
          <Input name="minutes" type="number" inputMode="numeric" min={0} max={59} value={minutes} onChange={(e) => setMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))} aria-label="Minuten" />
          <Input name="seconds" type="number" inputMode="numeric" min={0} max={59} value={seconds} onChange={(e) => setSeconds(Math.max(0, Math.min(59, Number(e.target.value) || 0)))} aria-label="Seconden" />
        </div>
        <Hint>Uren · minuten · seconden</Hint>
      </div>
      {meta.kind === "cardio" ? (
        <div>
          <Label htmlFor="distance_km">Afstand (km)</Label>
          <Input id="distance_km" type="text" inputMode="decimal" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} placeholder="5,0" required />
          <Hint>{preview ? `Gemiddeld ${preview}` : "Tempo verschijnt zodra duur en afstand zijn ingevuld."}</Hint>
        </div>
      ) : null}
      <div>
        <Label htmlFor="notes">Opmerkingen (optioneel)</Label>
        <Textarea id="notes" name="notes" defaultValue={initial?.notes ?? ""} maxLength={1000} className="min-h-[72px]" placeholder="Hoe ging het?" />
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {sessionId ? "Wijzigingen opslaan" : "Training opslaan"}
      </Button>
    </form>
  );
}
