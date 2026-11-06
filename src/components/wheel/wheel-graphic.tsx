import type { Segment } from "@/lib/wheel";
import { SlotIconView } from "./category-icon";

const RIM = 100;
const FACE = 86;
const INK = "#6e4034";

/** Rounded, so server and browser render the same numbers. */
function point(angle: number, r: number): [number, number] {
  const a = (angle * Math.PI) / 180;
  return [Math.round(r * Math.sin(a) * 1000) / 1000, Math.round(-r * Math.cos(a) * 1000) / 1000];
}

function slice(start: number, end: number): string {
  const [x1, y1] = point(start, FACE);
  const [x2, y2] = point(end, FACE);
  const large = end - start > 180 ? 1 : 0;
  return `M0 0 L${x1} ${y1} A${FACE} ${FACE} 0 ${large} 1 ${x2} ${y2} Z`;
}

/**
 * The wheel face in the style of the Weekrad announcement: equal soft slots
 * with a line icon and label, a dark rim with small dots. Angle 0 is the top.
 */
export function WheelGraphic({ segments }: { segments: readonly Segment[] }) {
  const step = 360 / segments.length;
  return (
    <svg viewBox="-100 -100 200 200" className="h-full w-full" aria-hidden>
      <circle r={RIM} fill={INK} />
      <circle r={93} fill="none" stroke="#e7c9a3" strokeWidth="0.6" opacity="0.7" />
      {Array.from({ length: segments.length * 3 }, (_, i) => {
        const [x, y] = point(i * (step / 3) + step / 6, 93);
        return <circle key={i} cx={x} cy={y} r="1.5" fill="#f3d9b5" />;
      })}
      {segments.map((s, i) => (
        <path key={i} d={slice(s.start, s.end)} fill={s.color} />
      ))}
      {segments.map((s, i) => {
        const [x1, y1] = point(s.start, FACE);
        return <line key={`l-${i}`} x1="0" y1="0" x2={x1} y2={y1} stroke="#ffffff" strokeOpacity="0.7" strokeWidth="0.8" />;
      })}
      {segments.map((s, i) => {
        const mid = Math.round((s.start + step / 2) * 100) / 100;
        const [x, y] = point(mid, 56);
        return (
          <g key={`i-${i}`} transform={`translate(${x} ${y})`}>
            <SlotIconView icon={s.icon} x={-9} y={-15} width={18} height={18} color={INK} strokeWidth={1.6} />
            <text y="12" textAnchor="middle" fontSize="7.4" fontWeight="600" fill={INK} style={{ fontFamily: "var(--font-sans, system-ui)" }}>
              {s.label}
            </text>
          </g>
        );
      })}
      <circle r={FACE} fill="none" stroke={INK} strokeOpacity="0.25" strokeWidth="0.6" />
    </svg>
  );
}
