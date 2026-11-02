import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireContext } from "@/lib/data";
import { formatDateNl, formatDateTimeNl, isEditableDate, todayKey } from "@/lib/dates";
import { activityByKey } from "@/lib/constants";
import { activityMeta, formatDistance, formatDuration, formatKg, formatPace, formatSpeed, formatVolume, muscleLabel, paceSecPerKm, sessionVolumeKg, speedKmh } from "@/lib/fitness";
import { loadSessionDetail } from "@/lib/fitness/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Card, SectionTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { SessionActions } from "@/components/fitness/session-actions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Training" };

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-[16px] px-3 py-2.5">
      <p className="font-display text-[20px] leading-none text-text">{value}</p>
      <p className="mt-1 text-[10.5px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

async function Content({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string | string[] }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await requireContext();
  const s = await loadSessionDetail(ctx, id);
  if (!s) notFound();
  if (s.status === "draft") redirect(`/fitness/workout/${s.id}`);
  const meta = activityMeta(s.activity_type);
  const done = sp.done === "1";
  const volume = sessionVolumeKg(s.exercises.flatMap((e) => e.sets));
  const pace = s.activity_type === "run" || s.activity_type === "walk" ? paceSecPerKm(s.distance_meters, s.duration_seconds) : null;
  const speed = s.activity_type === "cycle" ? speedKmh(s.distance_meters, s.duration_seconds) : null;
  const completedSets = s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.completed).length, 0);

  return (
    <Page className="space-y-4">
      <PageTitle title={s.title} subtitle={`${meta.label} · ${formatDateNl(s.workout_date)}`} back="/fitness/history" />

      {done ? (
        <Card variant="dark" className="rounded-[22px] p-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-paper/70">Training voltooid</p>
          <p className="mt-1.5 text-[12.5px] text-paper/80">
            {isEditableDate(ctx.challenge, s.workout_date)
              ? `Telt mee in je check-in van ${s.workout_date === todayKey(new Date(), ctx.challenge.timezone) ? "vandaag" : "gisteren"}: ${meta.checkin.map((k) => activityByKey(k)?.label ?? k).join(" en ")}.`
              : "Deze datum ligt buiten de check-in van vandaag en gisteren."}{" "}
            <Link href="/checkin" className="underline underline-offset-2">
              Bekijk check-in
            </Link>
          </p>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5">
        <Fact label="Duur" value={formatDuration(s.duration_seconds)} />
        {meta.kind === "cardio" ? <Fact label="Afstand" value={formatDistance(s.distance_meters)} /> : null}
        {pace ? <Fact label="Gem. tempo" value={formatPace(pace)} /> : null}
        {speed ? <Fact label="Gem. snelheid" value={formatSpeed(speed)} /> : null}
        {s.activity_type === "strength" ? (
          <>
            <Fact label="Volume" value={formatVolume(volume)} />
            <Fact label="Sets voltooid" value={String(completedSets)} />
          </>
        ) : null}
      </div>

      {s.activity_type === "strength" ? (
        <section>
          <SectionTitle>Oefeningen</SectionTitle>
          <div className="space-y-2">
            {s.exercises.map((e) => (
              <Card key={e.id} className="p-3.5">
                <div className="flex items-center gap-3">
                  <IconBadge icon={meta.icon} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-text">{e.name}</p>
                    <p className="text-[11px] text-muted">{muscleLabel(e.muscle_group)}</p>
                  </div>
                </div>
                <ul className="mt-2 space-y-1">
                  {e.sets.map((x) => (
                    <li key={x.id} className={cn("flex items-center justify-between rounded-[12px] px-3 py-1.5 text-[13px]", x.completed ? "bg-sage/15 text-text" : "bg-blush/50 text-muted line-through")}>
                      <span>Set {x.set_number}</span>
                      <span className="tabular-nums">
                        {x.weight_kg !== null ? formatKg(x.weight_kg) : "lichaamsgewicht"} × {x.repetitions ?? "–"}
                      </span>
                    </li>
                  ))}
                </ul>
                {e.notes ? <p className="mt-2 text-[12px] text-muted">{e.notes}</p> : null}
              </Card>
            ))}
            {s.exercises.length === 0 ? <p className="text-[13px] text-muted">Geen oefeningen vastgelegd.</p> : null}
          </div>
        </section>
      ) : null}

      {s.notes ? (
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Opmerkingen</p>
          <p className="mt-1 text-[14px] leading-relaxed text-text">{s.notes}</p>
        </Card>
      ) : null}

      <p className="text-[11.5px] text-muted">
        Vastgelegd op {formatDateTimeNl(s.completed_at ?? s.created_at, ctx.challenge.timezone)}
        {s.started_at ? ` · gestart ${formatDateTimeNl(s.started_at, ctx.challenge.timezone)}` : ""}
      </p>

      <SessionActions id={s.id} editHref={s.activity_type === "strength" ? `/fitness/workout/${s.id}` : `/fitness/history/${s.id}/edit`} />
    </Page>
  );
}

export default function SessionPage({ params, searchParams }: PageProps<"/fitness/history/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}
