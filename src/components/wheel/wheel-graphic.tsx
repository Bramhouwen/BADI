import { CATEGORY_META, type Segment } from "@/lib/wheel";
import { CategoryIcon } from "./category-icon";

const R = 92;

/** Rounded, so server and browser render the same numbers. */
function point(angle: number, r: number): [number, number] {
  const a = (angle * Math.PI) / 180;
  return [Math.round(r * Math.sin(a) * 1000) / 1000, Math.round(-r * Math.cos(a) * 1000) / 1000];
}

function arc(start: number, end: number): string {
  const [x1, y1] = point(start, R);
  const [x2, y2] = point(end, R);
  const large = end - start > 180 ? 1 : 0;
  return `M0 0 L${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
}

/** The wheel face: one segment per category, sized by its chance, with its icon. Angle 0 is the top. */
export function WheelGraphic({ segments }: { segments: readonly Segment[] }) {
  return (
    <svg viewBox="-100 -100 200 200" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="wheel-sheen" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 -20) scale(110)">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="99" fill="#fbf3ec" />
      <circle r="99" fill="none" stroke="rgba(110,64,52,0.12)" strokeWidth="1" />
      {segments.length === 1 ? (
        <circle r={R} fill={CATEGORY_META[segments[0].category].color} />
      ) : (
        segments.map((s) => <path key={s.category} d={arc(s.start, s.end)} fill={CATEGORY_META[s.category].color} stroke="#fbf3ec" strokeWidth="1.6" strokeLinejoin="round" />)
      )}
      <circle r={R} fill="url(#wheel-sheen)" />
      {Array.from({ length: 24 }, (_, i) => {
        const [x, y] = point(i * 15, 96);
        return <circle key={i} cx={x} cy={y} r="1.3" fill="rgba(110,64,52,0.28)" />;
      })}
      {segments.map((s) => {
        const span = s.end - s.start;
        const mid = s.start + span / 2;
        const size = span < 25 ? 12 : 18;
        const [x, y] = point(mid, segments.length === 1 ? 60 : 64);
        return (
          <g key={`i-${s.category}`} transform={`translate(${x} ${y}) rotate(${Math.round(mid * 100) / 100})`}>
            <CategoryIcon category={s.category} x={-size / 2} y={-size / 2} width={size} height={size} color="#fff" strokeWidth={2} />
          </g>
        );
      })}
    </svg>
  );
}
