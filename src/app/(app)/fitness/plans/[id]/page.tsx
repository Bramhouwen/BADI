import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/data";
import { loadExercises, loadPlan } from "@/lib/fitness/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { PlanEditor } from "@/components/fitness/plan-editor";

export const metadata = { title: "Schema" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const [plan, exercises] = await Promise.all([loadPlan(ctx, id), loadExercises(ctx)]);
  if (!plan) notFound();
  return (
    <Page>
      <PageTitle title="Schema" subtitle="Workouts, oefeningen en streefwaarden." back="/fitness/plans" />
      <PlanEditor plan={plan} exercises={exercises} />
    </Page>
  );
}

export default function PlanPage({ params }: PageProps<"/fitness/plans/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
