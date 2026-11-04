"use client";

import { useEffect, useRef, useState } from "react";
import { formatHold } from "@/lib/fitness";
import { cn } from "@/lib/utils";

/** Seconds to get into position before the hold starts. */
export const PREP_SECONDS = 5;

type Phase = { kind: "prep"; left: number } | { kind: "hold"; held: number; left: number | null };

/** Where a running hold timer is, from the moment it was started (timestamps, so a background tab stays correct). */
export function holdPhase(startedAt: number, now: number, target: number | null): Phase {
  const elapsed = Math.max(0, (now - startedAt) / 1000);
  if (elapsed < PREP_SECONDS) return { kind: "prep", left: Math.ceil(PREP_SECONDS - elapsed) };
  const held = Math.floor(elapsed - PREP_SECONDS);
  return { kind: "hold", held, left: target === null ? null : Math.max(0, target - held) };
}

/** "0:45" style clock. */
export function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function beep(ctx: AudioContext | null, times: number) {
  if (!ctx) return;
  for (let i = 0; i < times; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    const t = ctx.currentTime + i * 0.25;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}

/**
 * Countdown for one set of a timed exercise (plank). Five seconds to get in
 * position, then it counts down from the target, or up when there is none.
 * The end, or Stoppen, saves the time actually held and ticks the set off.
 */
export function HoldTimer({ setNumber, target, onDone, onEdit }: { setNumber: number; target: number | null; onDone: (seconds: number) => void; onEdit: () => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const audio = useRef<AudioContext | null>(null);
  const lock = useRef<{ release: () => Promise<void> } | null>(null);
  const holdBeeped = useRef(false);

  const phase = startedAt === null ? null : holdPhase(startedAt, now, target);

  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  function release() {
    lock.current?.release().catch(() => {});
    lock.current = null;
  }

  useEffect(() => release, []);

  function finish(seconds: number) {
    setStartedAt(null);
    release();
    beep(audio.current, 3);
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {}
    doneRef.current(seconds);
  }

  // Ticks while running: one beep when the hold starts, done when the target is reached.
  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const p = holdPhase(startedAt, t, target);
      if (p.kind !== "hold") return;
      if (!holdBeeped.current) {
        holdBeeped.current = true;
        beep(audio.current, 1);
      }
      if (p.left === 0 && target !== null) {
        clearInterval(id);
        finish(target);
      }
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, target]);

  async function start() {
    try {
      // Created on the tap itself, otherwise iOS keeps it muted.
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      audio.current ??= Ctx ? new Ctx() : null;
      await audio.current?.resume();
    } catch {}
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      lock.current = (await wl?.request("screen")) ?? null;
    } catch {}
    holdBeeped.current = false;
    const t = Date.now();
    setNow(t);
    setStartedAt(t);
  }

  function stop() {
    if (!phase || phase.kind === "prep") {
      setStartedAt(null);
      release();
      return;
    }
    finish(phase.held);
  }

  if (!phase) {
    return (
      <div className="flex items-center gap-2">
        <button type="button" onClick={start} className="espresso flex h-12 flex-1 items-center justify-center gap-2 rounded-full shadow-none">
          <span className="text-[14.5px] font-medium text-paper">{target ? `Start set ${setNumber} · ${clock(target)}` : `Start set ${setNumber}`}</span>
        </button>
        <button type="button" onClick={onEdit} className="flex h-12 items-center rounded-full border border-ink/10 bg-white px-4 shadow-sm hover:bg-blush">
          <span className="text-[13px] font-medium text-ink">Aanpassen</span>
        </button>
      </div>
    );
  }

  const shown = phase.kind === "prep" ? phase.left : phase.left ?? phase.held;
  const progress = phase.kind === "prep" ? 1 - phase.left / PREP_SECONDS : target ? Math.min(1, phase.held / target) : 0;
  return (
    <div className="glass rounded-[22px] p-4 text-center" role="timer" aria-live="off">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">{phase.kind === "prep" ? "Maak je klaar" : `Set ${setNumber} · houd vast`}</p>
      <p className={cn("mt-1 font-display text-[64px] leading-none tabular-nums", phase.kind === "prep" ? "text-muted" : "text-text")}>{phase.kind === "prep" ? shown : clock(shown)}</p>
      {phase.kind === "hold" && target === null ? <p className="mt-1 text-[12px] text-muted">Tik op Stoppen als je loslaat</p> : null}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden>
        <div className={cn("h-full rounded-full", phase.kind === "prep" ? "bg-ink/30" : "bg-sage")} style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={stop} className="espresso flex h-12 flex-1 items-center justify-center rounded-full shadow-none">
          <span className="text-[14.5px] font-medium text-paper">{phase.kind === "prep" ? "Annuleren" : `Stoppen · ${formatHold(phase.held)}`}</span>
        </button>
        {phase.kind === "hold" ? (
          <button
            type="button"
            onClick={() => {
              setStartedAt(null);
              release();
            }}
            className="flex h-12 items-center rounded-full border border-ink/10 bg-white px-4 shadow-sm"
          >
            <span className="text-[13px] font-medium text-ink">Annuleren</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
