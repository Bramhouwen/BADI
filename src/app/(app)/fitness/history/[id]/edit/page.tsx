import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireContext } from "@/lib/data";
import { todayKey } from "@/lib/dates";
import { activityMeta } from "@/lib/fitness";
import { loadSessionDetail } from "@/lib/fitness/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { CardioForm } from "@/components/fitness/cardio-form";

export const metadata = { title: "Training bewerken" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const s = await loadSessionDetail(ctx, id);
  if (!s) notFound();
  if (s.activity_type === "strength") redirect(`/fitness/workout/${id}`);
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const startTime = s.started_at ? new Intl.DateTimeFormat("nl-NL", { timeZone: ctx.challenge.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(s.started_at)) : "";
  return (
    <Page>
      <PageTitle title="Training bewerken" subtitle={activityMeta(s.activity_type).label} back={`/fitness/history/${id}`} />
      <CardioForm
        type={s.activity_type}
        today={today}
        sessionId={s.id}
        initial={{ title: s.title, workout_date: s.workout_date, start_time: startTime, duration_seconds: s.duration_seconds, distance_meters: s.distance_meters, notes: s.notes }}
      />
    </Page>
  );
}

export default function EditSessionPage({ params }: PageProps<"/fitness/history/[id]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
