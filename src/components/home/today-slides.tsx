"use client";

import { Children, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Droplets, Dumbbell, Flame, Footprints, Plus } from "lucide-react";
import { addWater } from "@/app/actions/water";
import { useToast } from "@/components/ui/toast";
import { CHART } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";

/** Swipeable row of cards with snap points, a peek of the next card and dots below. */
export function TodayCarousel({ children, label }: { children: ReactNode; label: string }) {
  const slides = Children.toArray(children);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const w = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth;
      setActive(Math.max(0, Math.min(slides.length - 1, Math.round(el.scrollLeft / (w + 10)))));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [slides.length]);

  function go(i: number) {
    const el = track.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - 20, behavior: "smooth" });
  }

  return (
    <section aria-label={label} aria-roledescription="carousel">
      <div ref={track} className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-5 px-5 pb-1">
        {slides.map((slide, i) => (
          <div key={i} className="w-[calc(100%-30px)] shrink-0 snap-start" aria-roledescription="slide" aria-label={`${i + 1} van ${slides.length}`}>
            {slide}
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex justify-center gap-1.5">
        {slides.map((_, i) => (
          <button key={i} type="button" onClick={() => go(i)} aria-label={`Kaart ${i + 1}`} aria-current={active === i} className="flex h-4 items-center px-0.5">
            <span className={cn("block h-1.5 rounded-full transition-all", active === i ? "w-5 bg-ink" : "w-1.5 bg-ink/20")} />
          </button>
        ))}
      </div>
    </section>
  );
}

function SlideShell({ children, href, className }: { children: ReactNode; href?: string; className?: string }) {
  const cls = cn("glass flex min-h-[172px] flex-col justify-between rounded-[22px] p-5", className);
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

function Eyebrow({ icon: Icon, children }: { icon: typeof Flame; children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-ink/60" strokeWidth={1.8} aria-hidden />
      <span className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted">{children}</span>
    </p>
  );
}

/** Your week: score, points and streak; opens the performance dashboard. */
export function WeekSlide({ fraction, earned, bonus = 0, total, streak }: { fraction: number; earned: number; bonus?: number; total: number; streak: number }) {
  return (
    <SlideShell href="/dashboard">
      <div>
        <Eyebrow icon={Flame}>Jouw week</Eyebrow>
        <p className="mt-2 font-sans text-[48px] font-semibold leading-none tabular-nums text-text">
          {Math.round(fraction * 100)}
          <span className="text-[20px] font-medium text-muted">%</span>
        </p>
      </div>
      <div>
        <div className="h-2 overflow-hidden rounded-full" style={{ background: CHART.track }} aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${Math.max(fraction > 0 ? 3 : 0, fraction * 100)}%`, background: CHART.green }} />
        </div>
        <p className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[12px] text-muted">
            {earned} van {total} punten{bonus ? <span className="font-medium text-ink"> +{bonus} bonus</span> : null} · streak {streak}
          </span>
          <span className="flex items-center gap-0.5 text-[12px] font-medium text-ink">
            Performance <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
          </span>
        </p>
      </div>
    </SlideShell>
  );
}

/** Steps this week against the weekly goal; opens the check-in to type today's count. */
export function StepsSlide({ total, goal, points, maxPoints }: { total: number; goal: number; points: number; maxPoints: number }) {
  const nl = new Intl.NumberFormat("nl-NL");
  const fraction = Math.min(1, total / goal);
  return (
    <SlideShell href="/checkin">
      <div>
        <Eyebrow icon={Footprints}>Stappen deze week</Eyebrow>
        <p className="mt-2 font-sans text-[40px] font-semibold leading-none tabular-nums text-text">
          {nl.format(total)}
          <span className="text-[18px] font-medium text-muted"> van {nl.format(goal)}</span>
        </p>
      </div>
      <div>
        <div className="h-2 overflow-hidden rounded-full" style={{ background: CHART.track }} aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${fraction * 100}%`, background: CHART.green }} />
        </div>
        <p className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[12px] text-muted">
            {points} van {maxPoints} punten{total < goal ? ` · nog ${nl.format(goal - total)}` : ""}
          </span>
          <span className="flex items-center gap-0.5 text-[12px] font-medium text-ink">
            Invullen <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
          </span>
        </p>
      </div>
    </SlideShell>
  );
}

/** Water today with one-tap adding, without leaving Home. */
export function WaterSlide({ total, goal }: { total: number; goal: number }) {
  const [ml, setMl] = useState(total);
  const [, start] = useTransition();
  const toast = useToast();
  const fraction = Math.min(1, ml / goal);
  const liters = (n: number) => (n / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 2 });

  function add(amount: number) {
    const before = ml;
    setMl(before + amount);
    start(async () => {
      const r = await addWater(amount);
      if (!r.ok) {
        setMl(before);
        toast(r.error, "error");
      } else if (r.data) setMl(r.data.total);
    });
  }

  return (
    <SlideShell>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow icon={Droplets}>Water vandaag</Eyebrow>
          <p className="mt-2 font-sans text-[40px] font-semibold leading-none tabular-nums text-text">
            {liters(ml)}
            <span className="text-[18px] font-medium text-muted"> van {liters(goal)} l</span>
          </p>
        </div>
        <Link href="/water" className="shrink-0 rounded-full bg-white/80 px-3 py-1.5 shadow-sm">
          <span className="text-[12px] font-medium text-ink">Water</span>
        </Link>
      </div>
      <div>
        <div className="h-2 overflow-hidden rounded-full" style={{ background: CHART.track }} aria-hidden>
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${fraction * 100}%`, background: CHART.blue }} />
        </div>
        <div className="mt-3 flex gap-2">
          {[250, 500].map((n) => (
            <button key={n} type="button" onClick={() => add(n)} className="flex h-9 flex-1 items-center justify-center gap-1 rounded-full bg-white shadow-sm ring-1 ring-ink/[0.06] active:scale-[0.98]">
              <Plus className="h-3.5 w-3.5 text-ink" strokeWidth={2} />
              <span className="text-[13px] font-medium text-ink">{n} ml</span>
            </button>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}

/** Training this week against the weekly targets, with the last session. */
export function TrainingSlide({ run, strength, runTarget, strengthTarget, last }: { run: number; strength: number; runTarget: number; strengthTarget: number; last: string | null }) {
  const bar = (done: number, target: number, color: string, label: string) => (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[12px] text-muted">{label}</span>
        <span className="text-[12px] font-semibold tabular-nums text-text">
          {done}/{target}
        </span>
      </div>
      <div className="flex gap-[3px]" aria-hidden>
        {Array.from({ length: target }).map((_, i) => (
          <span key={i} className="h-2 flex-1 rounded-full" style={{ background: i < done ? color : CHART.track }} />
        ))}
      </div>
    </div>
  );
  return (
    <SlideShell>
      <div className="flex items-start justify-between gap-3">
        <Eyebrow icon={Dumbbell}>Training deze week</Eyebrow>
        <Link href="/fitness/start" className="espresso flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 shadow-none">
          <span className="text-[12px] font-medium">Start</span>
        </Link>
      </div>
      <div className="space-y-2.5">
        {bar(run, runTarget, CHART.orange, "Hardlopen")}
        {bar(strength, strengthTarget, CHART.blue, "Kracht")}
        <p className="truncate">
          <span className="text-[11.5px] text-muted">{last ? `Laatste: ${last}` : "Nog geen training deze Winter Arc"}</span>
        </p>
      </div>
    </SlideShell>
  );
}
