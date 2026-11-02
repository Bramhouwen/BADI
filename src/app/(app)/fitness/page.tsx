import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Dumbbell, History, TrendingUp } from "lucide-react";
import { requireContext } from "@/lib/data";
import { todayKey } from "@/lib/dates";
import { formatDistance, formatMinutes, weekStats } from "@/lib/fitness";
import { loadSessions } from "@/lib/fitness/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Card, SectionTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { FitnessNav } from "@/components/fitness/fitness-nav";
import { SessionCard } from "@/components/fitness/session-card";

export const metadata = { title: "Fitness" };

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="glass rounded-[18px] px-3.5 py-3">
      <p className="font-display text-[24px] leading-none text-text">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{label}</p>
    </div>
  );
}

async function Content() {
  const ctx = await requireContext();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const [sessions, drafts] = await Promise.all([loadSessions(ctx, { status: "completed" }), loadSessions(ctx, { status: "draft", limit: 3 })]);
  const week = weekStats(sessions, today);
  const recent = sessions.slice(0, 3);
  const hasAny = sessions.length > 0;

  return (
    <Page className="space-y-5">
      <PageTitle title="Fitness" />
      <FitnessNav active="/fitness" />

      <section className="relative overflow-hidden rounded-[22px] bg-[#6a3b2f] text-paper shadow-[0_16px_34px_-20px_rgba(95,53,41,0.65)]" aria-label="Deze week">
        <div className="absolute inset-y-0 right-0 w-[56%]">
          <Image src="/photos/squat.jpg" alt="" fill sizes="(max-width: 512px) 56vw, 280px" className="object-cover object-[50%_25%]" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-[#6a3b2f] via-[#6a3b2f]/45 to-[#6a3b2f]/0" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#6a3b2f]/75 via-[#6a3b2f]/10 to-transparent" />
        </div>
        <div className="relative flex min-h-[172px] flex-col justify-between p-5">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-paper/70">Fitness tracker</p>
            <h2 className="mt-2 max-w-[66%] font-display text-[26px] italic leading-[1.1] text-paper">
              {week.workouts === 0 ? "Nog geen training deze week." : `${week.workouts} ${week.workouts === 1 ? "training" : "trainingen"} deze week.`}
            </h2>
            {week.workouts > 0 ? (
              <p className="mt-1.5 text-[12.5px] text-paper/85">
                {formatMinutes(week.seconds)}
                {week.meters > 0 ? ` · ${formatDistance(week.meters)}` : ""}
              </p>
            ) : null}
          </div>
          <Link href="/fitness/start" className="on-tile mt-4 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-paper px-5 text-[13.5px] font-medium">
            Start een training <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </div>
      </section>

      {drafts.length > 0 ? (
        <Card className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium text-text">Openstaand concept</p>
            <p className="truncate text-[12px] text-muted">{drafts[0].title}</p>
          </div>
          <Link href={`/fitness/workout/${drafts[0].id}`} className="espresso flex h-10 shrink-0 items-center rounded-full px-4 text-[13px] font-medium shadow-none">
            Verder
          </Link>
        </Card>
      ) : null}

      <section>
        <SectionTitle>Deze week</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          <Stat value={String(week.workouts)} label={week.workouts === 1 ? "training" : "trainingen"} />
          <Stat value={week.seconds > 0 ? formatMinutes(week.seconds) : "0 min"} label="trainingsminuten" />
          <Stat value={week.meters > 0 ? formatDistance(week.meters) : "0 km"} label="afstand" />
          <Stat value={String(week.activeDays)} label={week.activeDays === 1 ? "actieve dag" : "actieve dagen"} />
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2.5">
        {[
          { href: "/fitness/start", icon: Dumbbell, label: "Start workout" },
          { href: "/fitness/plans", icon: History, label: "Mijn schema's" },
          { href: "/fitness/progress", icon: TrendingUp, label: "Mijn progressie" },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="glass flex flex-col items-center gap-2 rounded-[18px] px-2 py-3.5 text-center hover:bg-blush/40">
            <IconBadge icon={a.icon} size="sm" />
            <span className="text-[12px] font-medium leading-tight text-text">{a.label}</span>
          </Link>
        ))}
      </section>

      <section>
        <SectionTitle action={hasAny ? <Link href="/fitness/history" className="text-[13px] text-muted">Bekijk alle trainingen</Link> : undefined}>Recente trainingen</SectionTitle>
        {hasAny ? (
          <div className="space-y-2">
            {recent.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        ) : (
          <Card className="p-5 text-center">
            <p className="font-display text-[22px] text-text">Jouw progressie begint hier.</p>
            <p className="mt-1 text-[13px] text-muted">Leg je eerste training vast en ontdek hoe ver je komt.</p>
            <Link href="/fitness/start" className="espresso mt-4 inline-flex h-11 items-center rounded-full px-5 text-[13.5px] font-medium">
              Start je eerste training
            </Link>
          </Card>
        )}
      </section>
    </Page>
  );
}

export default function FitnessPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
