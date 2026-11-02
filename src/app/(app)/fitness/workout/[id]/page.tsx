import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireContext } from "@/lib/data";
import { todayKey } from "@/lib/dates";
import { loadExercises, loadLastPerformance, loadSessionDetail } from "@/lib/fitness/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StrengthLogger } from "@/components/fitness/strength-logger";

export const metadata = { title: "Krachttraining" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const session = await loadSessionDetail(ctx, id);
  if (!session) notFound();
  if (session.activity_type !== "strength") redirect(`/fitness/history/${id}`);
  const [exercises, last] = await Promise.all([loadExercises(ctx), loadLastPerformance(ctx)]);
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const mode = session.status === "draft" ? "draft" : "edit";
  return (
    <Page>
      <PageTitle title={mode === "draft" ? "Krachttraining" : "Training bewerken"} subtitle={mode === "draft" ? "Voeg oefeningen toe en vink sets af." : "Pas sets, gewichten of herhalingen aan."} back={mode === "draft" ? "/fitness" : `/fitness/history/${id}`} />
      <StrengthLogger session={session} exercises={exercises} last={last} today={today} mode={mode} />
    </Page>
  );
}

export default function WorkoutPage({ params }: PageProps<"/fitness/workout/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
