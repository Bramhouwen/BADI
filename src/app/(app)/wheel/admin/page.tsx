import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { getSquad, requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { loadPrizes, loadWeights, SPIN_COLUMNS, type SpinRow } from "@/lib/wheel-server";
import { CATEGORY_META, PRIZE_CATEGORIES, STATUS_LABELS, formatEuro } from "@/lib/wheel";
import { formatDateNl } from "@/lib/dates";
import { firstName, cn } from "@/lib/utils";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/ui/card";
import { ClaimControls, WeightsForm } from "./admin-forms";

export const metadata = { title: "Weekrad beheren" };

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-sans text-[20px] font-semibold tabular-nums text-text">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

async function Content() {
  const ctx = await requireContext();
  if (ctx.membership.role !== "admin") notFound();
  const supabase = await createClient();
  const [weights, prizes, squad, { data: spinRows }, { data: codeRows }] = await Promise.all([
    loadWeights(ctx.challenge.id),
    loadPrizes(ctx.challenge.id),
    getSquad(ctx.challenge.id),
    supabase.from("wheel_spins").select(SPIN_COLUMNS).eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }),
    supabase.from("wheel_codes").select("spin_id, code"),
  ]);
  const spins = (spinRows ?? []) as SpinRow[];
  const codes = new Map(((codeRows ?? []) as { spin_id: string; code: string }[]).map((c) => [c.spin_id, c.code]));
  const won = spins.filter((s) => s.category !== "challenge");
  const cost = won.reduce((a, s) => a + (prizes.find((p) => p.id === s.prize_id)?.cost_cents ?? 0), 0);
  const open = won.filter((s) => s.status !== "delivered");
  const delivered = won.filter((s) => s.status === "delivered").slice(0, 20);
  const nameOf = (id: string) => firstName(squad.find((m) => m.user_id === id)?.profile.display_name ?? "Iemand");
  const prizeOf = (id: string | null) => prizes.find((p) => p.id === id);
  const short = (d: string) => formatDateNl(d, { day: "numeric", month: "short" }).replace(".", "");

  return (
    <Page className="space-y-6">
      <PageTitle title="Weekrad beheren" subtitle="Alleen zichtbaar voor jou als beheerder." back="/wheel" />

      <section aria-label="Overzicht" className="glass grid grid-cols-4 gap-1 rounded-[22px] px-2 py-4">
        <Stat value={String(spins.length)} label="draaibeurten" />
        <Stat value={String(won.length)} label="prijzen" />
        <Stat value={String(spins.length - won.length)} label="challenges" />
        <Stat value={formatEuro(cost)} label="kosten" />
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
                  {CATEGORY_META[c].label}
                </p>
                {list.length === 0 ? (
                  <p className="glass rounded-[18px] px-4 py-3 text-[12.5px] text-muted">Geen prijzen.</p>
                ) : (
                  <ul className="glass divide-y divide-ink/[0.06] rounded-[18px] px-4">
                    {list.map((p) => {
                      const live = p.active && p.stock > 0;
                      return (
                        <li key={p.id}>
                          <Link href={`/wheel/admin/prize/${p.id}`} className="flex items-center gap-3 py-3">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-medium text-text">
                                {p.brand}: {p.name}
                              </span>
                              <span className="block text-[11.5px] text-muted">
                                Voorraad {p.stock}
                                {p.weekly_max ? ` · max ${p.weekly_max} per week` : ""}
                                {p.cost_cents ? ` · ${formatEuro(p.cost_cents)}` : ""}
                                {p.variants.length ? ` · ${p.variant_label ?? "Keuze"}: ${p.variants.join(", ")}` : ""}
                              </span>
                            </span>
                            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium", live ? "bg-sage/25 text-ink" : "bg-blush text-muted")}>
                              {live ? "Actief" : p.active ? "Op" : "Uit"}
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
