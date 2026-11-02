import { cn } from "@/lib/utils";

/** Minimal bar chart in brand colours; labels under the bars. */
export function Bars({ data, unit, highlightLast = true }: { data: { label: string; value: number }[]; unit?: string; highlightLast?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex h-28 items-end gap-1.5">
        {data.map((d, i) => {
          const h = Math.max(4, Math.round((d.value / max) * 100));
          const last = highlightLast && i === data.length - 1;
          return (
            <div key={d.label + i} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] tabular-nums text-muted">{d.value > 0 ? d.value : ""}</span>
              <div className="flex h-20 w-full items-end rounded-full bg-blush/70">
                <div className={cn("w-full rounded-full transition-all", last ? "bg-sage" : "bg-ink/35")} style={{ height: `${h}%` }} aria-label={`${d.label}: ${d.value}${unit ? " " + unit : ""}`} />
              </div>
              <span className="text-[10px] uppercase tracking-wide text-muted">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Minimal line chart as inline SVG. Values are plotted in order; lower is better when `invert`. */
export function Line({ points, formatY, invert = false }: { points: { label: string; value: number }[]; formatY: (v: number) => string; invert?: boolean }) {
  if (points.length === 0) return null;
  const w = 320;
  const h = 120;
  const pad = 14;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => (points.length === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (points.length - 1));
  const y = (v: number) => {
    const t = (v - min) / span;
    return invert ? pad + t * (h - pad * 2) : h - pad - t * (h - pad * 2);
  };
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" role="img" aria-label="Verloop">
        <path d={d} fill="none" stroke="var(--sage)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4.5 : 3} fill={i === points.length - 1 ? "var(--ink)" : "#fdf8f4"} stroke="var(--sage)" strokeWidth="2" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-muted">
        <span>{points[0].label}</span>
        <span className="font-medium text-text">Laatste: {formatY(last.value)}</span>
        <span>{last.label}</span>
      </div>
    </div>
  );
}
