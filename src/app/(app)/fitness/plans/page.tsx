import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardList, Plus } from "lucide-react";
import { requireContext } from "@/lib/data";
import { loadPlans } from "@/lib/fitness/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBadge } from "@/components/ui/icon-badge";
import { FitnessNav } from "@/components/fitness/fitness-nav";
import { AskBaddyLink } from "@/components/coach/ask-baddy";

export const metadata = { title: "Mijn schema's" };

async function Content() {
  const ctx = await requireContext();
  const plans = await loadPlans(ctx);
  return (
    <Page className="space-y-4">
      <PageTitle title="Mijn schema's" subtitle="Templates die je steeds opnieuw kunt starten." />
      <FitnessNav active="/fitness/plans" />
      <AskBaddyLink question="Maak een krachtschema voor 3 keer per week, ik train ongeveer 45 minuten per keer" label="Laat Baddy een schema maken" />
      {plans.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nog geen schema"
          body="Maak een schema met één of meer workouts, bijvoorbeeld een full body of een lower body dag. Vanuit een schema start je een training met alle oefeningen al klaar."
          action={
            <Link href="/fitness/plans/new" className="espresso inline-flex h-11 items-center gap-2 rounded-full px-5 text-[13.5px] font-medium">
              <Plus className="h-4 w-4" strokeWidth={1.8} /> Nieuw schema
            </Link>
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {plans.map((p) => (
              <li key={p.id}>
                <Link href={`/fitness/plans/${p.id}`} className="glass flex items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-3 hover:bg-blush/40">
                  <IconBadge icon={ClipboardList} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-text">{p.name}</span>
                    <span className="block truncate text-[11.5px] text-muted">
                      {p.templates.length} {p.templates.length === 1 ? "workout" : "workouts"}
                      {p.goal ? ` · ${p.goal}` : ""}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted" strokeWidth={1.6} />
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/fitness/plans/new" className="espresso inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[13.5px] font-medium">
            <Plus className="h-4 w-4" strokeWidth={1.8} /> Nieuw schema
          </Link>
        </>
      )}
    </Page>
  );
}

export default function PlansPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
