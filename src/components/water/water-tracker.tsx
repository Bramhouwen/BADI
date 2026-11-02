"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { ChevronRight, Coffee, CupSoda, Droplets, GlassWater, Minus, Plus, Undo2 } from "lucide-react";
import { IconBadge } from "@/components/ui/icon-badge";
import { motion, useReducedMotion } from "motion/react";
import { WATER_GOAL_ML, WATER_QUICK_ADD } from "@/lib/constants";
import { addWater, undoLastWater } from "@/app/actions/water";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { WaterWave } from "./water-wave";
import { formatMl } from "@/lib/format";

interface Props {
  total: number;
  goal?: number;
  /** compact = card on Home, full = the dedicated page */
  variant?: "compact" | "full";
}

const QUICK_ICONS = { glass: GlassWater, bottle: Droplets, cup: Coffee, big: CupSoda } as const;

export function WaterTracker({ total, goal = WATER_GOAL_ML, variant = "full" }: Props) {
  const [pending, start] = useTransition();
  const [opt, setOpt] = useOptimistic(total, (_p: number, next: number) => next);
  const [custom, setCustom] = useState(250);
  const toast = useToast();
  const reduce = useReducedMotion();
  const level = Math.min(1, opt / goal);
  const remaining = Math.max(0, goal - opt);
  const pct = Math.round(level * 100);

  function add(ml: number) {
    start(async () => {
      setOpt(opt + ml);
      const r = await addWater(ml);
      if (!r.ok) toast(r.error, "error");
      else if (r.data && r.data.total >= goal && opt < goal) toast("Doel gehaald. Goed gehydrateerd! 💧", "success");
    });
  }

  function undo() {
    start(async () => {
      const r = await undoLastWater();
      if (!r.ok) toast(r.error, "error");
      else setOpt(r.data!.total);
    });
  }

  if (variant === "compact") {
    return (
      <Link href="/water" className="glass flex items-stretch overflow-hidden rounded-[20px]">
        <WaterWave level={level} className="w-[96px] shrink-0 bg-blush">
          <div className="flex h-[96px] items-center justify-center">
            <span className="font-display text-[22px] text-ink">{pct}%</span>
          </div>
        </WaterWave>
        <div className="flex flex-1 flex-col justify-center px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Water vandaag</p>
          <p className="mt-0.5 font-display text-[22px] leading-none text-text">{formatMl(opt)}</p>
          <p className="mt-1 text-[12px] text-muted">{remaining > 0 ? `Nog ${formatMl(remaining)} tot ${formatMl(goal)}` : "Doel gehaald voor vandaag"}</p>
        </div>
        <div className="flex items-center pr-3">
          <span className="soft flex h-9 w-9 items-center justify-center rounded-full">
            <ChevronRight className="h-4 w-4" strokeWidth={1.6} />
          </span>
        </div>
      </Link>
    );
  }

  return (
    <div className="space-y-5">
      <div className="glass overflow-hidden rounded-[28px]">
        <WaterWave level={level} className="min-h-[380px] bg-blush/60">
          <div className="flex min-h-[380px] flex-col items-center justify-between px-6 pb-6 pt-8">
            <div className="text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Vandaag gedronken</p>
              <p className="mt-2 font-display text-[52px] leading-none text-text">{formatMl(opt)}</p>
              <p className="mt-2 text-sm text-muted">{remaining > 0 ? `Nog ${formatMl(remaining)} te gaan` : "Doel gehaald"}</p>
            </div>
            <div className="flex w-full items-center justify-between">
              <span className="font-display text-3xl text-ink/80">{pct}%</span>
              <div className="flex items-center gap-3">
                <motion.button
                  type="button"
                  aria-label="Laatste hoeveelheid verwijderen"
                  disabled={pending || opt === 0}
                  whileTap={reduce ? undefined : { scale: 0.92 }}
                  onClick={undo}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white/85 text-ink shadow-[0_8px_22px_-10px_rgba(107,58,46,0.4)] disabled:opacity-40"
                >
                  <Minus className="h-5 w-5" strokeWidth={1.8} />
                </motion.button>
                <motion.button
                  type="button"
                  aria-label={`Voeg ${custom} ml toe`}
                  disabled={pending}
                  whileTap={reduce ? undefined : { scale: 0.92 }}
                  onClick={() => add(custom)}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-ink shadow-[0_12px_30px_-10px_rgba(107,58,46,0.45)]"
                >
                  <Plus className="h-7 w-7" strokeWidth={1.8} />
                </motion.button>
              </div>
              <span className="w-[64px] text-right text-sm font-semibold text-ink/80">{custom} ml</span>
            </div>
          </div>
        </WaterWave>
      </div>

      <div>
        <p className="mb-2 px-1 text-[13px] font-medium text-muted">Snel toevoegen</p>
        <div className="grid grid-cols-2 gap-3">
          {WATER_QUICK_ADD.map((q) => (
            <button
              key={q.ml}
              type="button"
              disabled={pending}
              onClick={() => {
                setCustom(q.ml);
                add(q.ml);
              }}
              className={cn("glass flex items-center gap-3 rounded-full py-2 pl-2 pr-4 text-left transition active:scale-[0.98]", custom === q.ml && "ring-2 ring-sage")}
            >
              <IconBadge icon={QUICK_ICONS[q.icon]} size="sm" tone={custom === q.ml ? "sage" : "soft"} className="rounded-full" />
              <span>
                <span className="block text-[14px] font-medium text-text">{q.ml} ml</span>
                <span className="block text-[12px] text-muted">{q.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="glass space-y-3 rounded-[22px] px-4 py-4">
        <div className="flex items-center justify-between">
          <label htmlFor="water-custom" className="text-sm font-medium text-text">
            Eigen hoeveelheid
          </label>
          <span className="text-sm font-semibold text-ink">{custom} ml</span>
        </div>
        <input
          id="water-custom"
          type="range"
          min={50}
          max={1000}
          step={50}
          value={custom}
          onChange={(e) => setCustom(Number(e.target.value))}
          className="h-1.5 w-full accent-[var(--water-deep)]"
          aria-label="Eigen hoeveelheid in ml"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Plus voegt deze hoeveelheid toe, min haalt de laatste toevoeging weg.</p>
          <button type="button" onClick={undo} disabled={pending || opt === 0} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs text-muted hover:bg-blush hover:text-ink disabled:opacity-40">
            <Undo2 className="h-3.5 w-3.5" /> Laatste ongedaan maken
          </button>
        </div>
      </div>
    </div>
  );
}
