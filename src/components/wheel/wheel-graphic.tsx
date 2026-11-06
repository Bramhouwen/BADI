import type { Segment } from "@/lib/wheel";
import { CategoryIcon } from "./category-icon";

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
 * The wheel face in the style of the Weekrad announcement: soft slices sized
 * by their real chance, a line icon and the level name, a dark rim with small
 * dots. The jackpot slice is gold. Angle 0 is the top.
 */
export function WheelGraphic({ segments }: { segments: readonly Segment[] }) {
  return (
    <svg viewBox="-100 -100 200 200" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="wheel-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3d488" />
          <stop offset="0.55" stopColor="#d9a63c" />
          <stop offset="1" stopColor="#b8832a" />
        </linearGradient>
      </defs>
      <circle r={RIM} fill={INK} />
      <circle r={93} fill="none" stroke="#e7c9a3" strokeWidth="0.6" opacity="0.7" />
      {Array.from({ length: 24 }, (_, i) => {
        const [x, y] = point(i * 15 + 7.5, 93);
        return <circle key={i} cx={x} cy={y} r="1.5" fill="#f3d9b5" />;
      })}
      {segments.length === 1 ? (
        <circle r={FACE} fill={segments[0].color} />
      ) : (
        segments.map((s, i) => <path key={i} d={slice(s.start, s.end)} fill={s.category === "jackpot" ? "url(#wheel-gold)" : s.color} />)
      )}
      {segments.length > 1
        ? segments.map((s, i) => {
            const [x1, y1] = point(s.start, FACE);
            return <line key={`l-${i}`} x1="0" y1="0" x2={x1} y2={y1} stroke="#ffffff" strokeOpacity="0.75" strokeWidth="0.8" />;
          })
        : null}
      {segments.map((s, i) => {
        const span = s.end - s.start;
        const mid = Math.round((s.start + span / 2) * 100) / 100;
        const jackpot = s.category === "jackpot";
        const color = jackpot ? "#fff8e6" : INK;
        // Narrow slices (the jackpot at 2%) only get an icon, further out.
        if (span < 22) {
          const [x, y] = point(mid, 72);
          return (
            <g key={`i-${i}`} transform={`translate(${x} ${y})`}>
              <CategoryIcon category={s.category} x={-5.5} y={-5.5} width={11} height={11} color={color} strokeWidth={2} />
            </g>
          );
        }
        const narrow = span < 45;
        const size = narrow ? 13 : 17;
        const font = narrow ? 5.6 : 7;
        const [x, y] = point(mid, narrow ? 62 : 56);
        return (
          <g key={`i-${i}`} transform={`translate(${x} ${y})`}>
            <CategoryIcon category={s.category} x={-size / 2} y={-size - 3} width={size} height={size} color={color} strokeWidth={1.6} />
            {s.lines.map((line, j) => (
              <text key={j} y={4 + j * (font + 1.4)} textAnchor="middle" fontSize={font} fontWeight="600" fill={color} style={{ fontFamily: "var(--font-sans, system-ui)" }}>
                {line}
              </text>
            ))}
          </g>
        );
      })}
      <circle r={FACE} fill="none" stroke={INK} strokeOpacity="0.25" strokeWidth="0.6" />
    </svg>
  );
}
