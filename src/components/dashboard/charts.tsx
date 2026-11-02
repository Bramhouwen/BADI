"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatDateNl } from "@/lib/dates";
import { CHART } from "@/lib/chart-colors";

/** Small floating value label for the tapped or hovered mark. */
function Tip({ children, left, align = "center" }: { children: ReactNode; left: string; align?: "start" | "center" | "end" }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-[10px] bg-[#2b1813] px-2 py-1 shadow-lg",
        align === "center" ? "-translate-x-1/2" : align === "end" ? "-translate-x-full" : "",
      )}
      style={{ left }}
      role="status"
    >
      <span className="text-[11px] font-medium tabular-nums text-paper">{children}</span>
    </span>
  );
}

export interface Bar {
  key: string;
  label: string;
  value: number;
  tip: string;
}

/** Column chart, one series. `goal` draws a hairline reference; `current` marks the bar of now. */
export function Columns({ data, color = CHART.green, goal, goalLabel, current, max: maxIn, height = 120, empty = "Nog geen gegevens" }: { data: Bar[]; color?: string; goal?: number; goalLabel?: string; current?: string; max?: number; height?: number; empty?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, maxIn ?? 0, goal ?? 0, ...data.map((d) => d.value));
  const goalTop = goal ? (1 - goal / max) * height : null;
  return (
    <div onPointerLeave={() => setActive(null)}>
      <div className="relative" style={{ height }}>
        {goalTop !== null ? (
          <div className="pointer-events-none absolute inset-x-0 border-t border-ink/25" style={{ top: goalTop }}>
            {goalLabel ? (
              <span className="absolute -top-[15px] left-0">
                <span className="text-[10px] text-muted">{goalLabel}</span>
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 border-t" style={{ borderColor: CHART.grid }} />
        {data.every((d) => d.value === 0) ? (
          <p className="absolute inset-0 flex items-center justify-center">
            <span className="text-[12px] text-muted">{empty}</span>
          </p>
        ) : null}
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {data.map((d, i) => {
            const h = d.value > 0 ? Math.max(4, (d.value / max) * height) : 0;
            const dim = current !== undefined && d.key !== current && active !== i;
            return (
              <button
                key={d.key}
                type="button"
                onPointerEnter={() => setActive(i)}
                onClick={() => setActive(active === i ? null : i)}
                aria-label={d.tip}
                className="relative flex h-full flex-1 items-end justify-center"
              >
                <span className="block w-full max-w-[24px] rounded-t-[4px] transition-opacity" style={{ height: h, background: color, opacity: dim ? 0.45 : 1 }} />
                {active === i ? (
                  <Tip left={i < 2 ? "0%" : i > data.length - 3 ? "100%" : "50%"} align={i < 2 ? "start" : i > data.length - 3 ? "end" : "center"}>
                    {d.tip}
                  </Tip>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px]" aria-hidden>
        {data.map((d) => (
          <span key={d.key} className={cn("flex-1 text-center", d.key === current ? "text-ink" : "text-muted")}>
            <span className="text-[10px] font-medium">{d.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export interface StackSeries {
  key: string;
  label: string;
  color: string;
}

/** Stacked columns with a 2px surface gap between segments and a legend above. */
export function StackedColumns({ data, series, height = 120, unit }: { data: { key: string; label: string; values: Record<string, number> }[]; series: StackSeries[]; height?: number; unit: string }) {
  const [active, setActive] = useState<number | null>(null);
  const totals = data.map((d) => series.reduce((a, s) => a + (d.values[s.key] ?? 0), 0));
  const max = Math.max(1, ...totals);
  return (
    <div onPointerLeave={() => setActive(null)}>
      <div className="mb-2.5 flex flex-wrap gap-x-3.5 gap-y-1">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
            <span className="text-[11.5px] text-muted">{s.label}</span>
          </span>
        ))}
      </div>
      <div className="relative" style={{ height }}>
        <div className="absolute inset-x-0 bottom-0 border-t" style={{ borderColor: CHART.grid }} />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {data.map((d, i) => {
            const tip = `${d.label}: ${series.map((s) => `${d.values[s.key] ?? 0} ${s.label.toLowerCase()}`).join(", ")}`;
            return (
              <button key={d.key} type="button" onPointerEnter={() => setActive(i)} onClick={() => setActive(active === i ? null : i)} aria-label={tip} className="relative flex h-full flex-1 items-end justify-center">
                <span className="flex w-full max-w-[24px] flex-col-reverse gap-[2px]">
                  {series.map((s, si) => {
                    const v = d.values[s.key] ?? 0;
                    if (!v) return null;
                    const top = series.slice(si + 1).every((x) => !(d.values[x.key] ?? 0));
                    return <span key={s.key} className={cn("block w-full", top && "rounded-t-[4px]")} style={{ height: Math.max(3, (v / max) * height - 2), background: s.color }} />;
                  })}
                </span>
                {active === i ? (
                  <Tip left={i < 2 ? "0%" : i > data.length - 3 ? "100%" : "50%"} align={i < 2 ? "start" : i > data.length - 3 ? "end" : "center"}>
                    {totals[i]} {unit}
                    {totals[i] ? ` · ${series.filter((s) => d.values[s.key]).map((s) => `${d.values[s.key]} ${s.label.toLowerCase()}`).join(", ")}` : ""}
                  </Tip>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px]" aria-hidden>
        {data.map((d) => (
          <span key={d.key} className="flex-1 text-center">
            <span className="text-[10px] font-medium text-muted">{d.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Line with a soft area wash, an end dot and tap-to-read points. Values 0 to `max`. */
export function Trend({ data, max, color = CHART.green, suffix = "" }: { data: { key: string; label: string; value: number }[]; max: number; color?: string; suffix?: string }) {
  const format = (v: number) => `${v.toLocaleString("nl-NL")}${suffix}`;
  const [active, setActive] = useState<number | null>(null);
  const w = 320;
  const h = 110;
  const padX = 8;
  const padY = 10;
  const x = (i: number) => (data.length === 1 ? w / 2 : padX + (i * (w - padX * 2)) / (data.length - 1));
  const y = (v: number) => padY + (1 - Math.min(1, v / (max || 1))) * (h - padY * 2);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)} ${h - padY} L${x(0).toFixed(1)} ${h - padY} Z`;
  const last = data.length - 1;
  const shown = active ?? last;
  return (
    <div onPointerLeave={() => setActive(null)}>
      <div className="relative">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-[110px] w-full overflow-visible" role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join(", ")}>
          {[0, 0.5, 1].map((t) => (
            <line key={t} x1={0} x2={w} y1={padY + t * (h - padY * 2)} y2={padY + t * (h - padY * 2)} stroke={CHART.grid} strokeWidth={1} />
          ))}
          <path d={area} fill={color} opacity={0.1} />
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={x(shown)} cy={y(data[shown].value)} r={5} fill={color} stroke="#fdf8f4" strokeWidth={2} />
        </svg>
        <div className="absolute inset-0 flex">
          {data.map((d, i) => (
            <button key={d.key} type="button" className="h-full flex-1" aria-label={`${d.label}: ${format(d.value)}`} onPointerEnter={() => setActive(i)} onClick={() => setActive(i)} />
          ))}
        </div>
        <Tip left={`${(x(shown) / w) * 100}%`} align={x(shown) / w > 0.75 ? "end" : x(shown) / w < 0.25 ? "start" : "center"}>
          {data[shown].label}: {format(data[shown].value)}
        </Tip>
      </div>
      <div className="mt-1.5 flex justify-between" aria-hidden>
        <span className="text-[10px] font-medium text-muted">{data[0]?.label}</span>
        <span className="text-[10px] font-medium text-muted">{data[last]?.label}</span>
      </div>
    </div>
  );
}

/** Three concentric rings, Apple Health style, with their values beside them. */
export function ActivityRings({ rings, size = 132 }: { rings: { label: string; value: string; fraction: number; color: string }[]; size?: number }) {
  const stroke = 12;
  const gap = 3;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden>
        {rings.map((ring, i) => {
          const r = size / 2 - stroke / 2 - i * (stroke + gap);
          const c = 2 * Math.PI * r;
          const f = Math.max(0, Math.min(1, ring.fraction));
          return (
            <g key={ring.label}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ring.color} strokeOpacity={0.16} strokeWidth={stroke} />
              {f > 0 ? <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ring.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} style={{ transition: "stroke-dasharray 700ms ease" }} /> : null}
            </g>
          );
        })}
      </svg>
      <ul className="min-w-0 space-y-2.5">
        {rings.map((ring) => (
          <li key={ring.label} className="flex items-start gap-2">
            <span className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ring.color }} aria-hidden />
            <span className="min-w-0">
              <span className="block text-[11.5px] text-muted">{ring.label}</span>
              <span className="block text-[17px] font-semibold tabular-nums leading-tight text-text">{ring.value}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Calendar of the challenge: one cell per day, darker green for more daily points. */
export function Heatmap({ columns, today }: { columns: ({ date: string; points: number | null } | null)[][]; today: string }) {
  const labelOf = (date: string) => formatDateNl(date, { weekday: "short", day: "numeric", month: "short" });
  const [active, setActive] = useState<string | null>(null);
  const cell = (points: number | null) => (points === null ? "transparent" : points === 0 ? CHART.track : CHART.green);
  const opacity = (points: number | null) => (points === null || points === 0 ? 1 : 0.25 + (points / 6) * 0.75);
  const activeCell = columns.flat().find((c) => c?.date === active) ?? null;
  return (
    <div onPointerLeave={() => setActive(null)}>
      <div className="flex gap-[3px]">
        <div className="mr-1 flex flex-col gap-[3px]" aria-hidden>
          {["ma", "di", "wo", "do", "vr", "za", "zo"].map((d, i) => (
            <span key={d} className="flex h-[15px] items-center">
              <span className="text-[9px] text-muted">{i % 2 === 0 ? d : ""}</span>
            </span>
          ))}
        </div>
        {columns.map((col, ci) => (
          <div key={ci} className="flex flex-1 flex-col gap-[3px]">
            {col.map((c, ri) =>
              c ? (
                <button
                  key={c.date}
                  type="button"
                  onPointerEnter={() => setActive(c.date)}
                  onClick={() => setActive(c.date)}
                  aria-label={`${labelOf(c.date)}: ${c.points === null ? "nog niet" : `${c.points} van 6 punten`}`}
                  className={cn("h-[15px] w-full rounded-[4px]", c.date === today && "ring-2 ring-ink/60 ring-offset-1 ring-offset-[#fdf8f4]", c.points === null && "border border-dashed border-ink/15")}
                  style={{ background: cell(c.points), opacity: opacity(c.points) }}
                />
              ) : (
                <span key={ri} className="h-[15px]" />
              ),
            )}
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <span className="min-h-[16px] truncate">
          <span className="text-[11.5px] text-muted">{activeCell ? `${labelOf(activeCell.date)}: ${activeCell.points === null ? "nog niet" : `${activeCell.points} van 6 punten`}` : "Tik op een dag"}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1" aria-hidden>
          <span className="text-[10px] text-muted">0</span>
          {[0, 2, 4, 6].map((p) => (
            <span key={p} className="h-[11px] w-[11px] rounded-[3px]" style={{ background: cell(p), opacity: opacity(p) }} />
          ))}
          <span className="text-[10px] text-muted">6</span>
        </span>
      </div>
    </div>
  );
}

/** Stat tile: label, value with unit, optional change against last week. */
export function Stat({ label, value, unit, change, changeUnit = "", hint }: { label: string; value: string | number; unit?: string; change?: number | null; changeUnit?: string; hint?: string }) {
  return (
    <div className="rounded-[18px] bg-[#fdf8f4] px-3.5 py-3 ring-1 ring-ink/[0.05]">
      <p className="text-[11.5px] text-muted">{label}</p>
      <p className="mt-0.5 font-sans text-[24px] font-semibold leading-tight tabular-nums text-text">
        {value}
        {unit ? <span className="text-[13px] font-medium text-muted"> {unit}</span> : null}
      </p>
      {change !== undefined && change !== null ? (
        <p className="mt-0.5 text-[11px] tabular-nums text-muted">
          <span className={cn("font-semibold", change > 0 ? "text-[#3f7a33]" : change < 0 ? "text-[#a14a1f]" : "text-muted")}>
            {change > 0 ? "▲" : change < 0 ? "▼" : "="} {Math.abs(change).toLocaleString("nl-NL")}
            {changeUnit}
          </span>{" "}
          t.o.v. vorige week
        </p>
      ) : hint ? (
        <p className="mt-0.5 text-[11px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
