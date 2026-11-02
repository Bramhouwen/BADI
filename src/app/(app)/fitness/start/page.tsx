import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireContext } from "@/lib/data";
import { ACTIVITY_TYPES } from "@/lib/fitness";
import { loadPlans } from "@/lib/fitness/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { FitnessNav } from "@/components/fitness/fitness-nav";
import { StartStrengthButton } from "@/components/fitness/session-actions";
import { startFromTemplate, startStrengthSession } from "@/app/actions/fitness";

export const metadata = { title: "Training starten" };

async function Content() {
  const ctx = await requireContext();
  const plans = await loadPlans(ctx);
  const templates = plans.flatMap((p) => p.templates.map((t) => ({ ...t, planName: p.name }))).slice(0, 6);

  return (
    <Page className="space-y-5">
      <PageTitle title="Training starten" subtitle="Kies wat je gaat doen." />
      <FitnessNav active="/fitness/start" />

      <ul className="space-y-2">
        {ACTIVITY_TYPES.map((a) =>
          a.kind === "strength" ? (
            <li key={a.key} className="glass flex items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-3">
              <IconBadge icon={a.icon} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-text">{a.label}</span>
                <span className="block text-[11.5px] text-muted">{a.hint}</span>
              </span>
              <div className="w-[96px]">
                <StartStrengthButton action={startStrengthSession.bind(null, {})} label="Start" />
              </div>
            </li>
          ) : (
            <li key={a.key}>
              <Link href={`/fitness/start/${a.key}`} className="glass flex items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-3 hover:bg-blush/40">
                <IconBadge icon={a.icon} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-text">{a.label}</span>
                  <span className="block text-[11.5px] text-muted">{a.hint}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted" strokeWidth={1.6} />
              </Link>
            </li>
          ),
        )}
      </ul>

      {templates.length > 0 ? (
        <section>
          <SectionTitle action={<Link href="/fitness/plans" className="text-[13px] text-muted">{"Alle schema's"}</Link>}>{"Uit je schema's"}</SectionTitle>
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id} className="glass flex items-center gap-3 rounded-[18px] py-2.5 pl-3.5 pr-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-text">{t.name}</span>
                  <span className="block text-[11.5px] text-muted">{t.planName}</span>
                </span>
                <div className="w-[96px]">
                  <StartStrengthButton action={startFromTemplate.bind(null, t.id)} label="Start" variant="secondary" />
                </div>
              </li>
            ))}
          </ul>
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
