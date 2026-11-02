import { Suspense } from "react";
import Link from "next/link";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayKey, weekdayShortNl } from "@/lib/dates";
import { WATER_GOAL_ML } from "@/lib/constants";
import { Page, PageTitle } from "@/components/ui/page";
import { AskBaddyLink } from "@/components/coach/ask-baddy";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Card, SectionTitle } from "@/components/ui/card";
import { WaterTracker } from "@/components/water/water-tracker";
import { formatMl } from "@/lib/format";
import type { WaterEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Water" };

async function Content() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const from = addDays(today, -6);
  const { data } = await supabase
    .from("water_entries")
    .select("log_date, amount_ml")
    .eq("user_id", ctx.userId)
    .gte("log_date", from)
    .lte("log_date", today);
  const entries = (data ?? []) as Pick<WaterEntry, "log_date" | "amount_ml">[];
  const { data: bottleRows } = await supabase.from("water_bottles").select("id, name, amount_ml").eq("user_id", ctx.userId).order("created_at", { ascending: true });
  const perDay = new Map<string, number>();
  for (const e of entries) perDay.set(e.log_date, (perDay.get(e.log_date) ?? 0) + e.amount_ml);
  const total = perDay.get(today) ?? 0;
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => ({ d, ml: perDay.get(d) ?? 0 }));
  const max = Math.max(WATER_GOAL_ML, ...days.map((x) => x.ml));
  const goalDays = days.filter((x) => x.ml >= WATER_GOAL_ML).length;

  return (
    <Page className="space-y-6">
      <PageTitle title="Water" subtitle={`Richtlijn: ${formatMl(WATER_GOAL_ML)} per dag. Jouw behoefte kan anders zijn.`} back="/" />
      <WaterTracker total={total} goal={WATER_GOAL_ML} variant="full" bottles={(bottleRows ?? []) as { id: string; name: string; amount_ml: number }[]} />
      <AskBaddyLink question="Geef me praktische tips om dagelijks 2,5 tot 3 liter water te drinken" label="Tips van Baddy voor meer water" />

      <section>
        <SectionTitle>Laatste zeven dagen</SectionTitle>
        <Card className="p-5">
          <div className="flex h-36 items-end justify-between gap-2">
            {days.map(({ d, ml }) => {
              const h = Math.max(6, Math.round((ml / max) * 100));
              const hit = ml >= WATER_GOAL_ML;
              return (
                <div key={d} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-28 w-full items-end rounded-full bg-tile-2/70">
                    <div className={cn("w-full rounded-full transition-all", hit ? "bg-water-deep" : "bg-water/70")} style={{ height: `${h}%` }} aria-label={`${d}: ${formatMl(ml)}`} />
                  </div>
                  <span className={cn("text-[11px] font-semibold uppercase", d === today ? "text-ink" : "text-muted")}>{weekdayShortNl(d)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs text-muted">
            {goalDays} van 7 dagen boven de richtlijn. Dit telt niet mee voor je streak; vink bij je check-in{" "}
            <Link href="/checkin" className="font-semibold text-ink underline-offset-2 hover:underline">
              Goed gehydrateerd
            </Link>{" "}
            aan.
          </p>
        </Card>
      </section>
    </Page>
  );
}

export default function WaterPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
