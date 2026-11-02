import { Suspense } from "react";
import { requireContext } from "@/lib/data";
import { MUSCLE_GROUPS } from "@/lib/fitness";
import { loadExercises } from "@/lib/fitness/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { FitnessNav } from "@/components/fitness/fitness-nav";
import { ExerciseList } from "./exercise-list";

export const metadata = { title: "Oefeningen" };

async function Content() {
  const ctx = await requireContext();
  const exercises = await loadExercises(ctx);
  const order = ["mobility", "legs", "chest", "back", "shoulders", "arms", "core", "cardio", "other"];
  const groups = order
    .map((key) => ({
      key,
      label: MUSCLE_GROUPS.find((m) => m.key === key)?.label ?? key,
      items: exercises.filter((e) => e.muscle_group === key).map((e) => ({ id: e.id, name: e.name })),
    }))
    .filter((g) => g.items.length > 0);
  return (
    <Page className="space-y-4">
      <PageTitle title="Oefeningen" subtitle="Tik op een oefening om te zien hoe je hem uitvoert." />
      <FitnessNav active="/fitness/exercises" />
      <ExerciseList groups={groups} />
    </Page>
  );
}

export default function ExercisesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
