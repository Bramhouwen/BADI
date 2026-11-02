import { Suspense } from "react";
import Link from "next/link";
import { requireContext } from "@/lib/data";
import { ACTIVITY_TYPES } from "@/lib/fitness";
import { loadPlans } from "@/lib/fitness/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { FitnessNav } from "@/components/fitness/fitness-nav";
import { StartChoice } from "@/components/fitness/session-actions";
import { WorkoutRow } from "@/components/fitness/workout-card";
import { startStrengthSession } from "@/app/actions/fitness";

export const metadata = { title: "Training starten" };

async function Content() {
  const ctx = await requireContext();
  const plans = await loadPlans(ctx);
  const templates = plans.flatMap((p) => p.templates.map((template) => ({ template, planName: p.name }))).slice(0, 8);

  return (
    <Page className="space-y-5">
      <PageTitle title="Training starten" subtitle="Nu starten of achteraf invullen." />
      <FitnessNav active="/fitness/start" />

      <ul className="space-y-2">
        {ACTIVITY_TYPES.map((a) => (
          <li key={a.key} className="glass flex items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-3">
            <IconBadge icon={a.icon} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-text">{a.label}</span>
              <span className="block truncate text-[11.5px] text-muted">{a.hint}</span>
            </span>
            {a.kind === "strength" ? (
              <StartChoice start={startStrengthSession.bind(null, {})} after={startStrengthSession.bind(null, { afterwards: true })} />
            ) : (
              <StartChoice start={`/fitness/start/${a.key}`} after={`/fitness/start/${a.key}?achteraf=1`} />
            )}
          </li>
        ))}
      </ul>
      <p className="-mt-2 px-0.5 text-[11.5px] leading-snug text-muted">Start loopt mee met een timer. Achteraf vul je duur, oefeningen en sets in na je training.</p>

      {templates.length > 0 ? (
        <section>
          <SectionTitle action={<Link href="/fitness/plans" className="text-[13px] text-muted">{"Alle schema's"}</Link>}>{"Uit je schema's"}</SectionTitle>
          <WorkoutRow items={templates} />
        </section>
      ) : null}
    </Page>
  );
}

export default function StartPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
