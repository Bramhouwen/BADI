import { Suspense } from "react";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { requireContext } from "@/lib/data";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_KEYS, draftStatus, sessionVolumeKg, type ActivityType } from "@/lib/fitness";
import { todayKey } from "@/lib/dates";
import { loadSessions, loadStrengthHistory } from "@/lib/fitness/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FitnessNav } from "@/components/fitness/fitness-nav";
import { SessionCard } from "@/components/fitness/session-card";
import { InProgress } from "@/components/fitness/in-progress";
import { cn } from "@/lib/utils";

export const metadata = { title: "Geschiedenis" };

async function Content({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
  const sp = await searchParams;
  const type = typeof sp.type === "string" && (ACTIVITY_TYPE_KEYS as string[]).includes(sp.type) ? (sp.type as ActivityType) : undefined;
  const ctx = await requireContext();
  const [sessions, drafts, strength] = await Promise.all([loadSessions(ctx, { status: "completed", type }), loadSessions(ctx, { status: "draft" }), loadStrengthHistory(ctx)]);
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const volumes = new Map(strength.sessions.map((s) => [s.id, sessionVolumeKg(s.exercises.flatMap((e) => e.sets))]));

  return (
    <Page className="space-y-4">
      <PageTitle title="Geschiedenis" subtitle="Alle opgeslagen trainingen, nieuwste eerst." />
      <FitnessNav active="/fitness/history" />
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1" role="tablist" aria-label="Filter op type">
        {[{ key: "", label: "Alles" }, ...ACTIVITY_TYPES.map((a) => ({ key: a.key, label: a.label }))].map((f) => {
          const on = (type ?? "") === f.key;
          return (
            <Link key={f.key} role="tab" aria-selected={on} href={f.key ? `/fitness/history?type=${f.key}` : "/fitness/history"} className={cn("shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-medium", on ? "espresso shadow-none" : "soft hover:bg-blush-2")}>
              {f.label}
            </Link>
          );
        })}
      </div>

      {!type ? <InProgress drafts={drafts.map((d) => ({ id: d.id, title: d.title, type: d.activity_type, status: draftStatus(d, today, ctx.challenge.timezone) }))} /> : null}

      {sessions.length === 0 ? (
        <EmptyState icon={Dumbbell} title="Nog geen trainingen" body={type ? "Nog geen training van dit type. Kies een ander filter of start een training." : "Leg je eerste training vast; daarna vind je hem hier terug."} />
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} volumeKg={volumes.get(s.id)} />
          ))}
        </div>
      )}
    </Page>
  );
}

export default function HistoryPage({ searchParams }: PageProps<"/fitness/history">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
