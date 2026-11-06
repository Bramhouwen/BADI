import { Suspense } from "react";
import { requireContext } from "@/lib/data";
import { loadWheelState } from "@/lib/wheel-server";
import { CATEGORY_META, formatChance } from "@/lib/wheel";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/ui/card";
import { CategoryIcon } from "@/components/wheel/category-icon";

export const metadata = { title: "Spelregels Weekrad" };

const RULES = [
  "Iedereen in de squad mag één keer per week gratis draaien. Elke maandag om 00:00 (Nederlandse tijd) staat een nieuwe beurt klaar; een ongebruikte beurt vervalt zondag om 23:59.",
  "De uitslag wordt op de server bepaald voordat het rad stopt. Eerst het prijsniveau volgens de kansen hieronder, daarna een prijs binnen dat niveau.",
  "Binnen een niveau valt niet elk product even vaak: kleinere prijzen komen vaker voor dan grote.",
  "Alleen prijzen die echt beschikbaar zijn kunnen vallen. Is een niveau tijdelijk leeg (op, maximum per week bereikt of buiten het prijzenbudget), dan staat het niet op het rad en houden de andere niveaus hun onderlinge verhouding.",
  "De vakken op het rad zijn zo groot als de kans: hoe groter het vak, hoe groter de kans.",
  "Een gewonnen prijs claim je in de app. De beheerder geeft de prijs persoonlijk; een cadeaubon krijg je als code in je prijzenkast.",
  "Een Extra Challenge loopt tot en met zondag. Voltooi je hem, dan krijg je +5 bonuspunten in die week.",
  "Winnaars worden in de squadchat gedeeld.",
];

async function Content() {
  const ctx = await requireContext();
  const state = await loadWheelState(ctx);
  return (
    <Page className="space-y-6">
      <PageTitle title="Spelregels" subtitle="Hoe het Weekrad werkt en wat je kansen zijn." back="/wheel" />

      <section aria-label="Winstkansen">
        <SectionTitle>Winstkansen per draai, nu</SectionTitle>
        <ul className="glass divide-y divide-ink/[0.06] rounded-[22px] px-4">
          {state.odds.map((o) => (
            <li key={o.category} className="flex items-center gap-3 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#efe3d8]">
                <CategoryIcon category={o.category} className="h-4 w-4 text-ink" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1 text-[14px] font-medium text-text">{CATEGORY_META[o.category].label}</span>
              <span className="shrink-0 text-[14px] font-semibold tabular-nums text-ink">{formatChance(o.chance)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 px-1 text-[11.5px] leading-snug text-muted">
          Dit zijn de kansen die nu gelden. Een niveau dat tijdelijk leeg is, staat er niet tussen; de andere houden hun onderlinge verhouding.
        </p>
      </section>

      <section aria-label="Regels">
        <SectionTitle>Regels</SectionTitle>
        <ol className="glass list-decimal space-y-2.5 rounded-[22px] py-4 pl-9 pr-4 text-[13.5px] leading-snug text-text">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </section>
    </Page>
  );
}

export default function WheelRulesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
