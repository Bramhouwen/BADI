import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireContext } from "@/lib/data";
import { todayKey } from "@/lib/dates";
import { ACTIVITY_TYPE_KEYS, activityMeta, type ActivityType } from "@/lib/fitness";
import { loadSessionDetail } from "@/lib/fitness/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { CardioForm, type CardioInitial } from "@/components/fitness/cardio-form";

export const metadata = { title: "Training vastleggen" };

async function Content({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<{ from?: string | string[]; title?: string | string[] }> }) {
  const { type } = await params;
  const sp = await searchParams;
  if (!(ACTIVITY_TYPE_KEYS as string[]).includes(type)) notFound();
  if (type === "strength") redirect("/fitness/start");
  const ctx = await requireContext();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const meta = activityMeta(type);

  let initial: CardioInitial | undefined;
  const from = typeof sp.from === "string" ? sp.from : null;
  if (from) {
    const prev = await loadSessionDetail(ctx, from);
    if (prev) initial = { title: prev.title, duration_seconds: prev.duration_seconds, distance_meters: prev.distance_meters, notes: prev.notes };
  }
  if (typeof sp.title === "string" && sp.title) initial = { ...(initial ?? {}), title: sp.title.slice(0, 80) };

  return (
    <Page>
      <PageTitle title={meta.label} subtitle="Vul je training in en sla hem op." back="/fitness/start" />
      <CardioForm type={type as ActivityType} today={today} initial={initial} />
    </Page>
  );
}

export default function StartTypePage({ params, searchParams }: PageProps<"/fitness/start/[type]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}
