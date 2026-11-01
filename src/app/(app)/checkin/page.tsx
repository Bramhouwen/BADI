import { Suspense } from "react";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { challengePhase, editableDates, todayKey, daysUntilStart } from "@/lib/dates";
import { computeStreakStats } from "@/lib/streaks";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckinForm } from "./checkin-form";
import type { DailyCheckin } from "@/lib/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Check-in" };

async function Content() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_checkins")
    .select("*")
    .eq("challenge_id", ctx.challenge.id)
    .eq("user_id", ctx.userId)
    .order("checkin_date", { ascending: false });
  const checkins = (data ?? []) as DailyCheckin[];
  const now = new Date();
  const today = todayKey(now, ctx.challenge.timezone);
  const phase = challengePhase(ctx.challenge, now);
  const dates = editableDates(ctx.challenge, now);
  const stats = computeStreakStats(
    checkins.map((c) => c.checkin_date),
    today,
  );

  if (phase === "before") {
    const d = daysUntilStart(ctx.challenge, now);
    return (
      <Page>
        <PageTitle title="Today I Showed Up." subtitle="Wat heb je vandaag voor jezelf gedaan?" />
        <EmptyState
          emoji="❄️"
          title={`De Winter Arc start over ${d} ${d === 1 ? "dag" : "dagen"}`}
          body="Vanaf de eerste dag kun je hier in een paar seconden inchecken. Tot die tijd: rust lekker uit."
        />
      </Page>
    );
  }

  if (phase === "after" || dates.length === 0) {
    return (
      <Page>
        <PageTitle title="Today I Showed Up." subtitle="De Winter Arc is afgerond." />
        <EmptyState
          emoji="✨"
          title="We showed up. We grew together."
          body={`Je hebt ${stats.total} ${stats.total === 1 ? "dag" : "dagen"} ingecheckt. Bekijk je Winter Arc Wrapped.`}
          action={
            <Link href="/wrapped">
              <Button>Naar Wrapped</Button>
            </Link>
          }
        />
      </Page>
    );
  }

  const existing = Object.fromEntries(
    checkins.filter((c) => dates.includes(c.checkin_date)).map((c) => [c.checkin_date, c]),
  ) as Record<string, DailyCheckin>;

  return (
    <Page>
      <PageTitle title="Today I Showed Up." subtitle="Wat heb je vandaag voor jezelf gedaan?" />
      <CheckinForm dates={dates} today={today} existing={existing} stats={stats} />
    </Page>
  );
}

export default function CheckinPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
