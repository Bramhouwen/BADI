import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, Settings2, Trophy } from "lucide-react";
import { requireContext } from "@/lib/data";
import { isDemo } from "@/lib/demo";
import { loadWheelState } from "@/lib/wheel-server";
import { CATEGORY_META, CHALLENGE_META, WHEEL_CHALLENGES, nextSpinAt } from "@/lib/wheel";
import { Page } from "@/components/ui/page";
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
      <div className="flex items-center justify-between">
        <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm hover:bg-blush" aria-label="Terug">
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </Link>
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
      </div>

      <header className="text-center">
        <h1 className="font-display text-[40px] leading-[1.02] text-ink">
          Draai het <span className="italic text-[#7f9670]">Weekrad</span>
        </h1>
        <p className="mx-auto mt-3 w-fit rounded-full bg-white/80 px-4 py-2 text-[13.5px] font-medium text-text shadow-sm">Jouw wekelijkse kans op iets leuks! 🎁</p>
      </header>

      <SpinWheel odds={state.odds} canSpin={!spin || isDemo()} unlimited={isDemo()} nextAt={nextAt} serverNow={state.now} />

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

      <section aria-label="Te winnen">
        <SectionTitle>Te winnen</SectionTitle>
        <ul className="glass divide-y divide-ink/[0.06] rounded-[22px] px-4">
          {state.odds.map((o) => {
            const items = o.category === "challenge" ? WHEEL_CHALLENGES.map((k) => CHALLENGE_META[k].title) : state.pool[o.category].map((p) => `${p.brand} ${p.name}`);
            return (
              <li key={o.category} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#efe3d8]">
                  <CategoryIcon category={o.category} className="h-4 w-4 text-ink" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-text">{CATEGORY_META[o.category].label}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-muted">{items.join(" · ")}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <Link href="/wheel/voorwaarden" className="mt-2 block px-1 text-[12.5px] text-muted underline underline-offset-2">
          Spelregels en winstkansen
        </Link>
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
