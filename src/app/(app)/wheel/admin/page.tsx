import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { getSquad, requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { loadPrizes, loadWeights, SPIN_COLUMNS, type SpinRow } from "@/lib/wheel-server";
import { CATEGORY_META, PRIZE_CATEGORIES, STATUS_LABELS, budgetWarning, expectedCost, formatChance, formatEuro, prizeChances, unavailableReason, wheelOdds, type Unavailable } from "@/lib/wheel";
import { formatDateNl, todayKey } from "@/lib/dates";
import { weekStartOf } from "@/lib/checkin-plan";
import { firstName, cn } from "@/lib/utils";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/ui/card";
import { BudgetForm, ClaimControls, WeightsForm } from "./admin-forms";

const REASON: Record<Unavailable, string> = { inactive: "Uit", stock: "Op", weekly: "Max deze week", budget: "Buiten budget" };

export const metadata = { title: "Weekrad beheren" };

async function Content() {
  const ctx = await requireContext();
  if (ctx.membership.role !== "admin") notFound();
  const supabase = await createClient();
  const [weights, prizes, squad, { data: spinRows }, { data: codeRows }, { data: settings }, { data: budgetLeftRaw }] = await Promise.all([
    loadWeights(ctx.challenge.id),
    loadPrizes(ctx.challenge.id),
    getSquad(ctx.challenge.id),
    supabase.from("wheel_spins").select(SPIN_COLUMNS).eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }),
    supabase.from("wheel_codes").select("spin_id, code"),
    supabase.from("wheel_settings").select("budget_cents, budget_period").eq("challenge_id", ctx.challenge.id).maybeSingle(),
    supabase.rpc("wheel_budget_status", { p_challenge: ctx.challenge.id }),
  ]);
  const spins = (spinRows ?? []) as SpinRow[];
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const weekStart = weekStartOf(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const localDate = (iso: string) => todayKey(new Date(iso), ctx.challenge.timezone);
  const budget = (settings as { budget_cents: number | null; budget_period: "week" | "month" } | null) ?? { budget_cents: null, budget_period: "month" as const };
  const budgetLeft = typeof budgetLeftRaw === "number" ? budgetLeftRaw : null;
  const winsThisWeek: Record<string, number> = {};
  for (const s of spins) if (s.prize_id && s.week_start === weekStart) winsThisWeek[s.prize_id] = (winsThisWeek[s.prize_id] ?? 0) + 1;
  const reasons = new Map(prizes.map((p) => [p.id, unavailableReason(p, winsThisWeek, budgetLeft)]));
  const available = prizes.filter((p) => reasons.get(p.id) === null);
  const odds = wheelOdds(weights, available);
  const chances = prizeChances(odds, available);
  const warning = budgetWarning(budgetLeft, prizes);
  const period = (from: string) => {
    const list = spins.filter((s) => localDate(s.created_at) >= from);
    const won = list.filter((s) => s.category !== "challenge");
    return { spins: list.length, prizes: won.length, cost: won.reduce((a, s) => a + (s.cost_cents ?? 0), 0) };
  };
  const week = period(weekStart);
  const month = period(monthStart);
  const codes = new Map(((codeRows ?? []) as { spin_id: string; code: string }[]).map((c) => [c.spin_id, c.code]));
  const won = spins.filter((s) => s.category !== "challenge");
  const open = won.filter((s) => s.status !== "delivered");
  const delivered = won.filter((s) => s.status === "delivered").slice(0, 20);
  const nameOf = (id: string) => firstName(squad.find((m) => m.user_id === id)?.profile.display_name ?? "Iemand");
  const prizeOf = (id: string | null) => prizes.find((p) => p.id === id);
  const short = (d: string) => formatDateNl(d, { day: "numeric", month: "short" }).replace(".", "");

  return (
    <Page className="space-y-6">
      <PageTitle title="Weekrad beheren" subtitle="Alleen zichtbaar voor jou als beheerder." back="/wheel" />

      <section aria-label="Overzicht" className="glass rounded-[22px] p-4">
        <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-baseline gap-x-3 gap-y-2 text-[13px]">
          <span />
          <span className="text-right text-[11px] text-muted">draaibeurten</span>
          <span className="text-right text-[11px] text-muted">prijzen</span>
          <span className="text-right text-[11px] text-muted">kosten</span>
          <span className="text-muted">Deze week</span>
          <span className="text-right font-semibold tabular-nums text-text">{week.spins}</span>
          <span className="text-right font-semibold tabular-nums text-text">{week.prizes}</span>
          <span className="text-right font-semibold tabular-nums text-text">{formatEuro(week.cost)}</span>
          <span className="text-muted">Deze maand</span>
          <span className="text-right font-semibold tabular-nums text-text">{month.spins}</span>
          <span className="text-right font-semibold tabular-nums text-text">{month.prizes}</span>
          <span className="text-right font-semibold tabular-nums text-text">{formatEuro(month.cost)}</span>
          <span className="text-muted">Totaal</span>
          <span className="text-right font-semibold tabular-nums text-text">{spins.length}</span>
          <span className="text-right font-semibold tabular-nums text-text">{won.length}</span>
          <span className="text-right font-semibold tabular-nums text-text">{formatEuro(won.reduce((a, s) => a + (s.cost_cents ?? 0), 0))}</span>
        </div>
      </section>

      <section aria-label="Budget">
        <SectionTitle>Budget</SectionTitle>
        <div className="glass space-y-3 rounded-[22px] p-4">
          {budget.budget_cents !== null ? (
            <p className="text-[13.5px] text-text">
              Nog <span className="font-semibold tabular-nums">{formatEuro(Math.max(0, budgetLeft ?? 0))}</span> van {formatEuro(budget.budget_cents)} deze {budget.budget_period === "week" ? "week" : "maand"}.
            </p>
          ) : (
            <p className="text-[13px] text-muted">Geen budget ingesteld: alleen voorraad en maximum per week begrenzen de prijzen.</p>
          )}
          {warning ? (
            <p className="rounded-[14px] bg-danger/12 px-3 py-2.5 text-[12.5px] leading-snug text-danger" role="alert">
              {warning === "empty"
                ? "Budget op: geen enkele prijs past nog. Tot de nieuwe periode valt iedereen op een challenge."
                : "Budget raakt op: de duurste prijzen vallen al van het rad. Niveaus zonder passende prijs verdwijnen; de andere houden hun verhouding."}
            </p>
          ) : null}
          <BudgetForm budget={budget.budget_cents !== null ? (budget.budget_cents / 100).toLocaleString("nl-NL") : ""} period={budget.budget_period} />
        </div>
      </section>

      <section aria-label="Claims">
        <SectionTitle>Uit te reiken ({open.length})</SectionTitle>
        {open.length === 0 ? (
          <p className="glass rounded-[22px] p-4 text-[13px] text-muted">Niets openstaand.</p>
        ) : (
          <ul className="space-y-3">
            {open.map((s) => {
              const prize = prizeOf(s.prize_id);
              return (
                <li key={s.id} className="glass rounded-[22px] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-text">
                        {nameOf(s.user_id)} · {s.prize_brand} {s.prize_name}
                      </p>
                      <p className="text-[12px] text-muted">
                        {short(s.week_start)}
                        {s.variant ? ` · ${prize?.variant_label ?? "Keuze"}: ${s.variant}` : ""}
                      </p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium", s.status === "won" ? "bg-gold/35 text-ink" : "bg-blush text-ink")}>
                      {STATUS_LABELS[s.status as keyof typeof STATUS_LABELS]}
                    </span>
                  </div>
                  <ClaimControls spinId={s.id} status={s.status} needsCode={Boolean(prize?.needs_code)} code={codes.get(s.id) ?? null} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Kansen">
        <SectionTitle>Kansen</SectionTitle>
        <div className="glass rounded-[22px] p-4">
          <WeightsForm weights={weights} />
        </div>
      </section>

      <section aria-label="Prijzen" id="prijzen">
        <SectionTitle
          action={
            <Link href="/wheel/admin/prize/new" className="flex items-center gap-1 text-[13px] font-medium text-ink">
              <Plus className="h-4 w-4" strokeWidth={1.8} aria-hidden /> Nieuwe prijs
            </Link>
          }
        >
          Prijzen
        </SectionTitle>
        <div className="space-y-4">
          {PRIZE_CATEGORIES.map((c) => {
            const list = prizes.filter((p) => p.category === c);
            return (
              <div key={c}>
                <p className="mb-1.5 flex items-center gap-2 px-1 text-[12px] font-medium text-muted">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_META[c].color }} aria-hidden />
                  {CATEGORY_META[c].label} · {CATEGORY_META[c].band}
                  <span className="ml-auto tabular-nums">{odds.find((o) => o.category === c) ? formatChance(odds.find((o) => o.category === c)!.chance) : "niet op het rad"}</span>
                </p>
                {list.length === 0 ? (
                  <p className="glass rounded-[18px] px-4 py-3 text-[12.5px] text-muted">Geen prijzen.</p>
                ) : (
                  <ul className="glass divide-y divide-ink/[0.06] rounded-[18px] px-4">
                    {list.map((p) => {
                      const reason = reasons.get(p.id) ?? null;
                      const chance = chances.get(p.id);
                      return (
                        <li key={p.id}>
                          <Link href={`/wheel/admin/prize/${p.id}`} className="flex items-center gap-3 py-3">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-medium text-text">
                                {p.brand}: {p.name}
                              </span>
                              <span className="block text-[11.5px] text-muted">
                                Voorraad {p.stock} · gewicht {p.weight}
                                {p.weekly_max ? ` · max ${p.weekly_max} per week` : ""}
                                {expectedCost(p) ? ` · kosten ${formatEuro(expectedCost(p))}` : ""}
                                {p.variants.length ? ` · ${p.variant_label ?? "Keuze"}: ${p.variants.join(", ")}` : ""}
                              </span>
                            </span>
                            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums", reason === null && chance !== undefined ? "bg-sage/25 text-ink" : "bg-blush text-muted")}>
                              {reason !== null ? REASON[reason] : chance === undefined ? "Niveau uit" : `${formatChance(chance)} per draai`}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {delivered.length > 0 ? (
        <section aria-label="Uitgereikt">
          <SectionTitle>Uitgereikt</SectionTitle>
          <ul className="glass divide-y divide-ink/[0.06] rounded-[22px] px-4">
            {delivered.map((s) => (
              <li key={s.id} className="py-3">
                <p className="text-[13.5px] text-text">
                  {nameOf(s.user_id)} · {s.prize_brand} {s.prize_name}
                </p>
                <ClaimControls spinId={s.id} status={s.status} needsCode={false} code={null} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Page>
  );
}

export default function WheelAdminPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
