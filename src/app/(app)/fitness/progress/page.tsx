import { Suspense } from "react";
import { TrendingUp } from "lucide-react";
import { requireContext } from "@/lib/data";
import { formatDateNl, todayKey } from "@/lib/dates";
import { formatDistance, formatDuration, formatKg, formatPace, formatVolume, mostWorkoutsInAWeek, runningProgress, strengthRecords, weeklyBuckets } from "@/lib/fitness";
import { loadSessions, loadStrengthHistory } from "@/lib/fitness/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Card, SectionTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FitnessNav } from "@/components/fitness/fitness-nav";
import { Bars, Line } from "@/components/fitness/charts";

export const metadata = { title: "Progressie" };

function weekLabel(start: string) {
  return formatDateNl(start, { day: "numeric", month: "short" }).replace(".", "");
}

async function Content() {
  const ctx = await requireContext();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const [sessions, strength] = await Promise.all([loadSessions(ctx, { status: "completed" }), loadStrengthHistory(ctx)]);

  if (sessions.length === 0) {
    return (
      <Page className="space-y-4">
        <PageTitle title="Progressie" subtitle="Frequentie, duur, hardlopen en kracht." />
        <FitnessNav active="/fitness/progress" />
        <EmptyState icon={TrendingUp} title="Nog geen gegevens" body="Zodra je trainingen vastlegt, zie je hier je frequentie, hardloopontwikkeling, krachtprogressie en persoonlijke records." />
      </Page>
    );
  }

  const weeks = weeklyBuckets(sessions, today, 8);
  const running = runningProgress(sessions);
  const records = strengthRecords(strength.rows);
  const busiest = mostWorkoutsInAWeek(sessions);
  const squat = records.find((r) => r.name.toLowerCase() === "squat");
  const bench = records.find((r) => r.name.toLowerCase() === "bench press");

  const prs: { label: string; value: string; sub?: string }[] = [];
  if (running.longestMeters > 0) prs.push({ label: "Langste hardloopafstand", value: formatDistance(running.longestMeters) });
  if (running.fastest5kSeconds) prs.push({ label: "Snelste 5 km", value: formatDuration(Math.round(running.fastest5kSeconds)), sub: "op basis van runs van 5,0 tot 5,5 km" });
  if (busiest.count > 0) prs.push({ label: "Meeste trainingen in een week", value: String(busiest.count), sub: busiest.weekStart ? `week van ${weekLabel(busiest.weekStart)}` : undefined });
  if (squat) prs.push({ label: "Hoogste squatgewicht", value: formatKg(squat.maxWeightKg), sub: formatDateNl(squat.maxWeightDate, { day: "numeric", month: "short" }) });
  if (bench) prs.push({ label: "Hoogste bench press", value: formatKg(bench.maxWeightKg), sub: formatDateNl(bench.maxWeightDate, { day: "numeric", month: "short" }) });
  for (const r of records) {
    if (r === squat || r === bench) continue;
    prs.push({ label: `Hoogste gewicht ${r.name}`, value: formatKg(r.maxWeightKg), sub: formatDateNl(r.maxWeightDate, { day: "numeric", month: "short" }) });
  }

  return (
    <Page className="space-y-5">
      <PageTitle title="Progressie" subtitle="Frequentie, duur, hardlopen en kracht." />
      <FitnessNav active="/fitness/progress" />

      <section>
        <SectionTitle>Trainingen per week</SectionTitle>
        <Card>
          <Bars data={weeks.map((w) => ({ label: weekLabel(w.start), value: w.workouts }))} />
        </Card>
      </section>

      <section>
        <SectionTitle>Trainingsminuten per week</SectionTitle>
        <Card>
          <Bars data={weeks.map((w) => ({ label: weekLabel(w.start), value: Math.round(w.seconds / 60) }))} unit="min" />
        </Card>
      </section>

      <section>
        <SectionTitle>Hardlopen</SectionTitle>
        {running.runs.length === 0 ? (
          <Card>
            <p className="text-[13px] text-muted">Nog geen hardlooptraining vastgelegd.</p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            <Card>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">Afstand per training</p>
              <Bars data={running.runs.slice(-8).map((r) => ({ label: formatDateNl(r.date, { day: "numeric", month: "short" }).replace(".", ""), value: Math.round(r.meters / 100) / 10 }))} unit="km" />
            </Card>
            {running.runs.filter((r) => r.pace).length >= 2 ? (
              <Card>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">Gemiddeld tempo (lager is sneller)</p>
                <Line points={running.runs.filter((r) => r.pace).slice(-10).map((r) => ({ label: formatDateNl(r.date, { day: "numeric", month: "short" }).replace(".", ""), value: r.pace as number }))} formatY={(v) => formatPace(v)} invert />
              </Card>
            ) : null}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Kracht per oefening</SectionTitle>
        {records.length === 0 ? (
          <Card>
            <p className="text-[13px] text-muted">Nog geen voltooide sets met gewicht vastgelegd.</p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {records.map((r) => (
              <Card key={r.exerciseId}>
                <div className="flex items-baseline justify-between">
                  <p className="text-[14px] font-medium text-text">{r.name}</p>
                  <p className="text-[12px] text-muted">
                    max <span className="font-medium text-text">{formatKg(r.maxWeightKg)}</span> · beste volume <span className="font-medium text-text">{formatVolume(r.bestSessionVolumeKg)}</span>
                  </p>
                </div>
                {r.history.length >= 2 ? (
                  <div className="mt-2">
                    <Line points={r.history.slice(-10).map((h) => ({ label: formatDateNl(h.date, { day: "numeric", month: "short" }).replace(".", ""), value: h.topWeightKg }))} formatY={(v) => formatKg(v)} />
                  </div>
                ) : (
                  <p className="mt-1 text-[12px] text-muted">
                    {r.history.length} sessie · {formatKg(r.history[0].topWeightKg)} op {formatDateNl(r.history[0].date, { day: "numeric", month: "short" })}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {prs.length > 0 ? (
        <section>
          <SectionTitle>Persoonlijke records</SectionTitle>
          <div className="space-y-2">
            {prs.map((p) => (
              <div key={p.label} className="glass flex items-center justify-between rounded-[16px] px-4 py-2.5">
                <div>
                  <p className="text-[13px] font-medium text-text">{p.label}</p>
                  {p.sub ? <p className="text-[11px] text-muted">{p.sub}</p> : null}
                </div>
                <p className="font-display text-[20px] text-text">{p.value}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </Page>
  );
}

export default function ProgressPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
