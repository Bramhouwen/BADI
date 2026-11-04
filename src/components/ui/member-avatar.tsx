"use client";

import { Avatar } from "@/components/ui/avatar";
import { SuperBadiFrame } from "@/components/ui/super-badi";
import { GOLD } from "@/lib/super-badi";
import { useIsOnline } from "@/lib/presence";
import { cn } from "@/lib/utils";

/**
 * Profile photo with this week's progress as a ring around it and a green
 * dot while the member has the app open. `progress` is 0 to 1; leave it out
 * (null) when the member does not share check-ins. `crown` marks the Super
 * Badi of the squad.
 */
export function MemberAvatar({
  userId,
  name,
  src,
  size,
  progress,
  crown = false,
  className,
}: {
  userId: string;
  name: string;
  src: string | null;
  /** Diameter of the photo in px; the ring adds 10 px around it. */
  size: number;
  progress?: number | null;
  crown?: boolean;
  className?: string;
}) {
  const online = useIsOnline(userId);
  const outer = size + 10;
  const stroke = 3.5;
  const r = (outer - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = progress === null || progress === undefined ? null : Math.max(0, Math.min(1, progress));
  const label = [name, crown ? "Super Badi" : null, p !== null ? `${Math.round(p * 100)}% van deze week` : null, online ? "online" : null].filter(Boolean).join(", ");

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: outer, height: outer }} role="img" aria-label={label}>
      {p !== null ? (
        <svg width={outer} height={outer} className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx={outer / 2} cy={outer / 2} r={r} fill="none" stroke={crown ? "transparent" : "rgba(95,53,41,0.12)"} strokeWidth={stroke} />
          {p > 0 ? (
            <circle
              cx={outer / 2}
              cy={outer / 2}
              r={r}
              fill="none"
              stroke={crown ? GOLD.light : "var(--sage)"}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${c * p} ${c}`}
              className="transition-[stroke-dasharray] duration-700"
            />
          ) : null}
        </svg>
      ) : null}
      <div className="absolute inset-[5px]">
        <Avatar name={name} src={src} className="h-full w-full ring-0" style={{ fontSize: Math.round(size * 0.3) }} />
      </div>
      {crown ? <SuperBadiFrame outer={outer} /> : null}
      {online ? (
        <span
          className="absolute rounded-full bg-[#4caf6a] ring-2 ring-white"
          style={{ width: Math.max(10, Math.round(size * 0.22)), height: Math.max(10, Math.round(size * 0.22)), right: 3, bottom: 3 }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}
