import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight, ClipboardList, History, PlayCircle, Plus, TrendingUp } from "lucide-react";
import { requireContext } from "@/lib/data";
import { todayKey } from "@/lib/dates";
import { draftStatus, formatMinutes, weekStats } from "@/lib/fitness";
import { loadPlans, loadSessions } from "@/lib/fitness/data";
import { trainingWeeks } from "@/lib/dashboard";
import { WEEKLY_TARGETS } from "@/lib/checkin-plan";
import { FILMED_EXERCISES } from "@/lib/exercise-video";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Card, SectionTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { SessionCard } from "@/components/fitness/session-card";
import { WorkoutRow } from "@/components/fitness/workout-card";
import { InProgress, type OpenDraft } from "@/components/fitness/in-progress";
import { AskBaddyLink } from "@/components/coach/ask-baddy";

export const metadata = { title: "Fitness" };

function WeekStat({ value, target, label }: { value: string; target?: number; label: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-sans text-[26px] font-semibold leading-none tabular-nums text-paper">
        {value}
        {target !== undefined ? <span className="text-[15px] font-medium text-paper/60">/{target}</span> : null}
      </p>
      <p className="mt-1 truncate text-[11.5px] text-paper/75">{label}</p>
    </div>
  );
}

function MenuTile({ href, icon, label, meta }: { href: string; icon: typeof History; label: string; meta: string }) {
  return (
    <Link href={href} className="glass flex items-center gap-2.5 rounded-[18px] p-3 hover:bg-blush/40">
      <IconBadge icon={icon} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-text">{label}</span>
        <span className="block truncate text-[11.5px] text-muted">{meta}</span>
      </span>
    </Link>
  );
}

async function Content() {
  const ctx = await requireContext();
  const tz = ctx.challenge.timezone;
  const today = todayKey(new Date(), tz);
  const [sessions, drafts, plans] = await Promise.all([loadSessions(ctx, { status: "completed" }), loadSessions(ctx, { status: "draft", limit: 5 }), loadPlans(ctx)]);
  const week = weekStats(sessions, today);
  const kinds = trainingWeeks(sessions, today, 1)[0];
  const workouts = plans.flatMap((p) => p.templates.map((template) => ({ template, planName: p.name }))).slice(0, 8);
  const open: OpenDraft[] = drafts.map((d) => ({ id: d.id, title: d.title, type: d.activity_type, status: draftStatus(d, today, tz) }));

  return (
    <Page className="space-y-6">
      <PageTitle title="Fitness" />

      <section className="relative -mt-2 overflow-hidden rounded-[24px] bg-[#6a3b2f] shadow-[0_16px_34px_-20px_rgba(95,53,41,0.65)]" aria-label="Deze week">
        <Image src="/photos/squat.jpg" alt="" fill sizes="(max-width: 512px) 100vw, 512px" className="object-cover object-[70%_25%] opacity-45" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-[#4a281f] via-[#4a281f]/70 to-[#4a281f]/30" />
        <div className="relative p-5">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-paper/70">Deze week</p>
          <div className="mt-3 flex gap-3">
            <WeekStat value={String(kinds.run)} target={WEEKLY_TARGETS.run} label="hardlopen" />
            <WeekStat value={String(kinds.strength)} target={WEEKLY_TARGETS.strength} label="kracht" />
            <WeekStat value={week.seconds > 0 ? formatMinutes(week.seconds) : "0 min"} label="getraind" />
          </div>
          <Link href="/fitness/start" className="on-tile mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-paper">
            <span className="text-[14.5px] font-medium text-ink">Training starten</span>
            <ArrowRight className="h-4 w-4 text-ink" strokeWidth={1.8} />
          </Link>
        </div>
      </section>

      <InProgress drafts={open} />

      <section>
        <SectionTitle action={workouts.length > 0 ? <Link href="/fitness/plans" className="text-[13px] text-muted">{"Alle schema's"}</Link> : undefined}>Jouw workouts</SectionTitle>
        {workouts.length > 0 ? (
          <WorkoutRow items={workouts} />
        ) : (
          <Card className="space-y-3 p-4">
            <p className="text-[13.5px] leading-snug text-text">Zet je vaste trainingen in een schema. Daarna start je ze met één tik, met video per oefening.</p>
            <Link href="/fitness/plans/new" className="espresso flex h-11 items-center justify-center gap-2 rounded-full">
              <Plus className="h-4 w-4" strokeWidth={1.8} />
              <span className="text-[13.5px] font-medium">Nieuw schema</span>
            </Link>
            <AskBaddyLink question="Maak een krachtschema voor 3 keer per week, ik train ongeveer 45 minuten per keer" label="Of laat Baddy een schema maken" />
          </Card>
        )}
      </section>

      <section aria-label="Meer">
        <div className="grid grid-cols-2 gap-2.5">
          <MenuTile href="/fitness/plans" icon={ClipboardList} label="Schema's" meta={plans.length === 0 ? "Nog geen schema" : `${plans.length} ${plans.length === 1 ? "schema" : "schema's"}`} />
          <MenuTile href="/fitness/exercises" icon={PlayCircle} label="Oefeningen" meta={`${FILMED_EXERCISES.length} met video`} />
          <MenuTile href="/fitness/history" icon={History} label="Geschiedenis" meta={`${sessions.length} ${sessions.length === 1 ? "training" : "trainingen"}`} />
          <MenuTile href="/fitness/progress" icon={TrendingUp} label="Progressie" meta="Records en grafieken" />
        </div>
      </section>

      <section>
        <SectionTitle
          action={
            sessions.length > 3 ? (
              <Link href="/fitness/history" className="flex items-center gap-0.5 text-[13px] text-muted">
                Alles <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.7} />
              </Link>
            ) : undefined
          }
        >
          Laatste trainingen
        </SectionTitle>
        {sessions.length > 0 ? (
          <div className="space-y-2">
            {sessions.slice(0, 3).map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        ) : (
          <p className="px-0.5 text-[13px] text-muted">Nog geen trainingen opgeslagen.</p>
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
