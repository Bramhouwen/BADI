import { Suspense } from "react";
import { requireContext } from "@/lib/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { NewPlanForm } from "./new-plan-form";

export const metadata = { title: "Nieuw schema" };

async function Content() {
  await requireContext();
  return (
    <Page>
      <PageTitle title="Nieuw schema" subtitle="Geef het een naam; workouts voeg je daarna toe." back="/fitness/plans" />
      <NewPlanForm />
    </Page>
  );
}

export default function NewPlanPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
