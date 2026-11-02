import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { IconBadge } from "@/components/ui/icon-badge";
import { activityMeta, formatDistance, formatDuration, formatVolume, paceSecPerKm, formatPace, speedKmh, formatSpeed } from "@/lib/fitness";
import { formatDateNl } from "@/lib/dates";
import type { SessionRow } from "@/lib/fitness/data";

export function sessionMetaLine(s: SessionRow, volumeKg?: number): string {
  const parts: string[] = [];
  if (s.duration_seconds) parts.push(formatDuration(s.duration_seconds));
  if (s.distance_meters) parts.push(formatDistance(s.distance_meters));
  if (s.activity_type === "run" || s.activity_type === "walk") {
    const p = paceSecPerKm(s.distance_meters, s.duration_seconds);
    if (p) parts.push(formatPace(p));
  } else if (s.activity_type === "cycle") {
    const v = speedKmh(s.distance_meters, s.duration_seconds);
    if (v) parts.push(formatSpeed(v));
  }
  if (s.activity_type === "strength" && volumeKg !== undefined && volumeKg > 0) parts.push(formatVolume(volumeKg));
  return parts.join(" · ");
}

export function SessionCard({ session, volumeKg }: { session: SessionRow; volumeKg?: number }) {
  const meta = activityMeta(session.activity_type);
  // A draft opens the logger so you can continue; a completed session opens its detail page.
  const href = session.status === "draft" ? `/fitness/workout/${session.id}` : `/fitness/history/${session.id}`;
  return (
    <Link href={href} className="glass flex items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-3 hover:bg-blush/40">
      <IconBadge icon={meta.icon} size="md" tone={session.status === "draft" ? "white" : "soft"} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-text">{session.title}</span>
        <span className="block truncate text-[11.5px] text-muted">
          {meta.label} · {formatDateNl(session.workout_date, { weekday: "short", day: "numeric", month: "short" })}
          {session.status === "draft" ? " · concept" : ""}
        </span>
        {session.status === "completed" ? <span className="block truncate text-[11.5px] text-ink/80">{sessionMetaLine(session, volumeKg)}</span> : null}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.6} />
    </Link>
  );
}
