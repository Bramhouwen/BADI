import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Settings2, Trophy } from "lucide-react";
import { requireContext } from "@/lib/data";
import { loadWheelState } from "@/lib/wheel-server";
import { CATEGORY_META, CHALLENGE_META, WHEEL_CHALLENGES, formatChance, nextSpinAt } from "@/lib/wheel";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/ui/card";
import { SpinWheel } from "@/components/wheel/spin-wheel";
import { CategoryIcon } from "@/components/wheel/category-icon";

export const metadata = { title: "Weekrad" };

async function Content() {
  await connection();
  const ctx = await requireContext();
  const state = await loadWheelState(ctx);
  const nextAt = nextSpinAt(state.weekStart, ctx.challenge.timezone).toISOString();
  const spin = state.mySpin;

  return (
    <Page className="space-y-6">
      <PageTitle
        title="Weekrad"
        subtitle="Elke maandag een nieuwe draaibeurt."
        back="/"
        action={
          <div className="flex items-center gap-2">
            {ctx.membership.role === "admin" ? (
              <Link href="/wheel/admin" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm hover:bg-blush" aria-label="Weekrad beheren">
                <Settings2 className="h-[18px] w-[18px]" strokeWidth={1.6} />
              </Link>
            ) : null}
            <Link href="/wheel/prizes" className="flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-ink shadow-sm hover:bg-blush">
              <Trophy className="h-4 w-4" strokeWidth={1.7} aria-hidden />
              Prijzenkast
            </Link>
          </div>
        }
      />

      <SpinWheel odds={state.odds} canSpin={!spin} nextAt={nextAt} serverNow={state.now} />

      {spin ? (
        <Link href="/wheel/prizes" className="glass flex items-center gap-3 rounded-[20px] p-3.5 hover:bg-blush/40">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: CATEGORY_META[spin.category].color }}>
            <CategoryIcon category={spin.category} className="h-5 w-5 text-white" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11.5px] text-muted">Deze week gedraaid</span>
            <span className="block truncate text-[14px] font-semibold text-text">
              {spin.challenge_key ? CHALLENGE_META[spin.challenge_key].title : `${spin.prize_brand}: ${spin.prize_name}`}
            </span>
          </span>
          <span className="text-[12.5px] font-medium text-ink">{spin.status === "won" ? "Claimen" : "Bekijk"}</span>
        </Link>
      ) : null}

      <section aria-label="Kansen">
        <SectionTitle>Kansen deze week</SectionTitle>
        <ul className="glass divide-y divide-ink/[0.06] rounded-[22px] px-4">
          {state.odds.map((o) => {
            const items = o.category === "challenge" ? WHEEL_CHALLENGES.map((k) => CHALLENGE_META[k].title) : state.pool[o.category].map((p) => `${p.brand} ${p.name}`);
            return (
              <li key={o.category} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: CATEGORY_META[o.category].color }}>
                  <CategoryIcon category={o.category} className="h-4 w-4 text-white" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-medium text-text">{CATEGORY_META[o.category].label}</span>
                    <span className="shrink-0 text-[14px] font-semibold tabular-nums text-ink">{formatChance(o.chance)}</span>
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-muted">{items.join(" · ")}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 px-1 text-[11.5px] leading-snug text-muted">
          Alleen categorieën met een beschikbare prijs staan op het rad. De uitslag wordt op de server bepaald voordat het rad stopt. De beheerder geeft de prijzen persoonlijk.
        </p>
      </section>
    </Page>
  );
}

export default function WheelPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
