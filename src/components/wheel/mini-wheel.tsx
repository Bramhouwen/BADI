import { SLOT_COLORS } from "@/lib/wheel";

/** A small Weekrad for the header: the same colours and rim as the real wheel. */
export function MiniWheel({ className }: { className?: string }) {
  const n = 6;
  const wedge = (i: number) => {
    const a1 = ((360 / n) * i * Math.PI) / 180;
    const a2 = ((360 / n) * (i + 1) * Math.PI) / 180;
    const r = 8.2;
    const p = (a: number) => `${Math.round(r * Math.sin(a) * 100) / 100} ${Math.round(-r * Math.cos(a) * 100) / 100}`;
    return `M0 0 L${p(a1)} A${r} ${r} 0 0 1 ${p(a2)} Z`;
  };
  return (
    <svg viewBox="-12 -12 24 24" className={className} aria-hidden>
      <circle r="11.5" fill="#6e4034" />
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={wedge(i)} fill={SLOT_COLORS[i % 3]} />
      ))}
      <circle r="3" fill="#6e4034" stroke="#fbf3ec" strokeWidth="1.2" />
      <path d="M0 -12.5 L-2.2 -9 L2.2 -9 Z" fill="#fbf3ec" />
    </svg>
  );
}
