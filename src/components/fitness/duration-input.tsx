"use client";

import { useState } from "react";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const parts = (v: number | null) => (v === null ? { min: "", sec: "" } : { min: String(Math.floor(v / 60)), sec: String(v % 60) });

/**
 * A hold time as minutes and seconds (plank: 1 min 30 sec). The parent gets
 * the total in seconds, or null when both fields are empty.
 */
export function DurationInput({ value, onValue, label, max = 3600, className }: { value: number | null; onValue: (seconds: number | null) => void; label: string; max?: number; className?: string }) {
  const [text, setText] = useState(() => parts(value));
  const [seen, setSeen] = useState(value);
  // A new value from outside (the timer, a copied set) replaces what is shown.
  if (value !== seen) {
    setSeen(value);
    setText(parts(value));
  }

  function change(next: { min: string; sec: string }) {
    const min = Math.max(0, Math.min(Math.floor(max / 60), Math.round(Number(next.min) || 0)));
    const sec = Math.max(0, Math.min(59, Math.round(Number(next.sec) || 0)));
    const total = next.min === "" && next.sec === "" ? null : Math.min(max, min * 60 + sec);
    setText(next);
    setSeen(total);
    onValue(total);
  }

  const field = "h-10 min-w-0 flex-1 rounded-[12px] px-1 py-0 text-center";
  return (
    <div className={cn("flex items-center gap-1.5", className)} role="group" aria-label={label}>
      <Input type="number" inputMode="numeric" min={0} value={text.min} placeholder="0" aria-label={`${label}, minuten`} className={field} onChange={(e) => change({ ...text, min: e.target.value })} />
      <span className="text-[11.5px] text-muted">min</span>
      <Input type="number" inputMode="numeric" min={0} max={59} value={text.sec} placeholder="0" aria-label={`${label}, seconden`} className={field} onChange={(e) => change({ ...text, sec: e.target.value })} />
      <span className="text-[11.5px] text-muted">sec</span>
    </div>
  );
}
