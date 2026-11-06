import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Gift, Trophy } from "lucide-react";
import { getSquad, requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { loadPrizes, myChallengeProgress, prizeImages, SPIN_COLUMNS, type SpinRow } from "@/lib/wheel-server";
import { CATEGORY_META, CHALLENGE_META, STATUS_LABELS, type ChallengeProgress } from "@/lib/wheel";
import { formatDateNl, todayKey } from "@/lib/dates";
import { weekStartOf } from "@/lib/checkin-plan";
import { firstName, cn } from "@/lib/utils";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryIcon } from "@/components/wheel/category-icon";
import { ClaimForm } from "@/components/wheel/claim-form";

export const metadata = { title: "Prijzenkast" };

const weekLabel = (start: string) => `week van ${formatDateNl(start, { day: "numeric", month: "short" }).replace(".", "")}`;

function ProgressCard({ spin, progress, current }: { spin: SpinRow; progress: ChallengeProgress | null; current: boolean }) {
  const meta = spin.challenge_key ? CHALLENGE_META[spin.challenge_key] : null;
  if (!meta) return null;
  const done = Boolean(spin.challenge_completed_at) || progress?.complete;
  return (
    <li className="glass rounded-[22px] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: CATEGORY_META.challenge.color }}>
          <CategoryIcon category="challenge" className="h-5 w-5 text-white" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] text-muted">{weekLabel(spin.week_start)}</p>
          <p className="text-[15px] font-semibold text-text">{meta.title}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{meta.rule}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium", done ? "bg-sage/25 text-ink" : current && !progress?.failed ? "bg-blush text-ink" : "bg-blush text-muted")}>
          {done ? "+5 bonus" : current && !progress?.failed ? "Bezig" : "Niet gehaald"}
        </span>
      </div>
      {progress && current ? (
        <div className="mt-3">
          <ol className="flex flex-wrap gap-1.5" aria-label={`Voortgang: ${progress.done} van ${progress.total}`}>
            {progress.steps.map((s) => (
              <li
                key={s.key}
                className={cn(
                  "flex h-8 min-w-8 items-center justify-center gap-1 rounded-full px-2.5 text-[11.5px] font-medium",
                  s.state === "done" ? "espresso" : s.state === "missed" ? "bg-danger/12 text-danger line-through" : "bg-white text-muted ring-1 ring-ink/10",
                )}
              >
                {s.state === "done" ? <Check className="h-3 w-3" strokeWidth={2.6} aria-hidden /> : null}
                {s.label}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[12px] text-muted">
            {progress.done} van {progress.total} {spin.challenge_key === "buddy" ? "complimenten" : "dagen"}
            {done ? " · voltooid, +5 bonuspunten deze week 🎉" : ""}
          </p>
        </div>
      ) : null}
    </li>
  );
}

async function Content() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const thisWeek = weekStartOf(today);
  const [{ data: spinRows }, prizes, squad] = await Promise.all([
    supabase.from("wheel_spins").select(SPIN_COLUMNS).eq("challenge_id", ctx.challenge.id).order("week_start", { ascending: false }).limit(80),
    loadPrizes(ctx.challenge.id),
    getSquad(ctx.challenge.id),
  ]);
  const spins = (spinRows ?? []) as SpinRow[];
  const mine = spins.filter((s) => s.user_id === ctx.userId);
  const myPrizes = mine.filter((s) => s.category !== "challenge");
  const myChallenges = mine.filter((s) => s.category === "challenge");
  const ids = myPrizes.map((s) => s.id);
  const [images, { data: codeRows }] = await Promise.all([prizeImages(prizes), ids.length ? supabase.from("wheel_codes").select("spin_id, code").in("spin_id", ids) : Promise.resolve({ data: [] })]);
  const codes = new Map(((codeRows ?? []) as { spin_id: string; code: string }[]).map((c) => [c.spin_id, c.code]));
  const prizeOf = (id: string | null) => prizes.find((p) => p.id === id) ?? null;
  const current = myChallenges.find((s) => s.week_start === thisWeek) ?? null;
  const progress = current ? await myChallengeProgress(ctx, current) : null;

  const open = myPrizes.filter((s) => s.status !== "delivered");
  const received = myPrizes.filter((s) => s.status === "delivered");
  const nameOf = (id: string) => firstName(squad.find((m) => m.user_id === id)?.profile.display_name ?? "Iemand");
  const squadWins = spins.filter((s) => s.user_id !== ctx.userId && s.category !== "challenge").slice(0, 12);

  return (
    <Page className="space-y-6">
      <PageTitle title="Prijzenkast" subtitle="Wat je gewonnen hebt en wat je nog krijgt." back="/wheel" />

      {mine.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Nog leeg"
          body="Draai aan het Weekrad. Prijzen en challenges komen hier te staan."
          action={
            <Link href="/wheel" className="espresso inline-flex h-11 items-center rounded-full px-5 text-[14px] font-semibold">
              Naar het Weekrad
            </Link>
          }
        />
      ) : null}

      {open.length > 0 ? (
        <section aria-label="Nog te krijgen">
          <SectionTitle>Nog te krijgen</SectionTitle>
          <ul className="space-y-3">
            {open.map((s) => {
              const prize = prizeOf(s.prize_id);
              const img = s.prize_id ? images.get(s.prize_id) : undefined;
              const code = codes.get(s.id);
              return (
                <li key={s.id} className="glass rounded-[22px] p-4">
                  <div className="flex gap-3">
                    <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[16px]" style={{ background: CATEGORY_META[s.category].color }}>
                      {img ? <Image src={img} alt="" width={160} height={160} className="h-full w-full object-cover" unoptimized /> : <CategoryIcon category={s.category} className="h-7 w-7 text-white" strokeWidth={1.6} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] uppercase tracking-[0.12em] text-muted">{s.prize_brand}</p>
                      <p className="text-[15px] font-semibold leading-tight text-text">{s.prize_name}</p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {weekLabel(s.week_start)}
                        {s.variant ? ` · ${prize?.variant_label ?? "Keuze"}: ${s.variant}` : ""}
                      </p>
                    </div>
                    <span className={cn("h-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium", s.status === "won" ? "bg-gold/35 text-ink" : "bg-blush text-ink")}>
                      {STATUS_LABELS[s.status as keyof typeof STATUS_LABELS]}
                    </span>
                  </div>
                  {code ? (
                    <div className="mt-3 rounded-[14px] bg-white px-3 py-2.5 ring-1 ring-ink/10">
                      <p className="text-[11px] text-muted">Code</p>
                      <p className="select-all font-mono text-[15px] font-semibold tracking-wide text-text">{code}</p>
                    </div>
                  ) : null}
                  {s.status === "won" ? (
                    <div className="mt-3">
                      <ClaimForm spinId={s.id} variantLabel={prize?.variants.length ? prize.variant_label : null} variants={prize?.variants ?? []} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {myChallenges.length > 0 ? (
        <section aria-label="Weekchallenges">
          <SectionTitle>Weekchallenges</SectionTitle>
          <ul className="space-y-3">
            {myChallenges.map((s) => (
              <ProgressCard key={s.id} spin={s} progress={s.id === current?.id ? progress : null} current={s.week_start === thisWeek} />
            ))}
          </ul>
        </section>
      ) : null}

      {received.length > 0 ? (
        <section aria-label="Ontvangen">
          <SectionTitle>Ontvangen</SectionTitle>
          <ul className="glass divide-y divide-ink/[0.06] rounded-[22px] px-4">
            {received.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <Gift className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.7} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">
                  {s.prize_brand}: {s.prize_name}
                </span>
                <span className="shrink-0 text-[12px] text-muted">{weekLabel(s.week_start)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {squadWins.length > 0 ? (
        <section aria-label="Gewonnen in de squad">
          <SectionTitle>Gewonnen in de squad</SectionTitle>
          <ul className="glass divide-y divide-ink/[0.06] rounded-[22px] px-4">
            {squadWins.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: CATEGORY_META[s.category].color }}>
                  <CategoryIcon category={s.category} className="h-3.5 w-3.5 text-white" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">
                  <span className="font-medium">{nameOf(s.user_id)}</span> · {s.prize_brand} {s.prize_name}
                </span>
                <span className="shrink-0 text-[12px] text-muted">{weekLabel(s.week_start)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Page>
  );
}

export default function PrizesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
