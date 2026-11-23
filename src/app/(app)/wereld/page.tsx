import { Suspense } from "react";
import Image from "next/image";
import { getSquad, requireContext } from "@/lib/data";
import { ensureWorldProfile, loadWorldProfiles } from "@/lib/world/server";
import { worldSpriteFor } from "@/lib/world/types";
import { firstName } from "@/lib/utils";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Wereld" };

const SCENE_NAMES: Record<string, string> = {
  buiten: "buiten in het dorp",
  woonkamer: "in de woonkamer",
  kantoor: "bij Traffic Today",
  sportschool: "in de sportschool",
};

/**
 * BADI Wereld, fase 0: you open the world from the app, logged in as yourself,
 * and see your name, your character and where you are. The world itself (walking,
 * scenes, depth) comes in fase 1; see docs/wereld/WERELD.md.
 */
async function Content() {
  const ctx = await requireContext();
  const [{ profile, missingTable }, squad, all] = await Promise.all([ensureWorldProfile(ctx), getSquad(ctx.challenge.id), loadWorldProfiles(ctx.challenge.id)]);
  const name = firstName(ctx.profile.display_name);
  const sprite = profile?.sprite ?? worldSpriteFor(ctx.profile.display_name);
  const others = squad.filter((m) => m.user_id !== ctx.userId);
  const seen = new Map(all.map((p) => [p.user_id, p]));

  return (
    <Page className="space-y-5">
      <PageTitle title="BADI Wereld" subtitle="Het dorp, het BADI-huis, Traffic Today en de sportschool." />

      <section aria-label="Jij in de wereld" className="flex items-end gap-4 rounded-[24px] bg-white/80 p-4 shadow-[0_14px_30px_-24px_rgba(95,53,41,0.6)] ring-1 ring-ink/[0.05]">
        {sprite ? (
          <Image src={`/wereld/poppetjes/${sprite}/staan-01.png`} alt={`Het poppetje van ${name}`} width={160} height={136} className="-mb-2 h-[120px] w-auto shrink-0" priority />
        ) : null}
        <div className="min-w-0 pb-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Welkom</p>
          <h2 className="font-display text-[30px] leading-tight text-text">{name}</h2>
          <p className="mt-1 text-[13.5px] text-muted">
            {missingTable ? "Je plek in de wereld wordt nog niet bewaard: migratie 0030 staat nog niet in Supabase." : `Je bent ${SCENE_NAMES[profile?.scene ?? "buiten"] ?? "in de wereld"}.`}
          </p>
          {!sprite ? <p className="mt-1 text-[13px] text-muted">Je poppetje voor de wereld is er nog niet.</p> : null}
        </div>
      </section>

      <section aria-label="Het dorp" className="overflow-hidden rounded-[24px] ring-1 ring-ink/[0.06]">
        <Image src="/wereld/scenes/buiten.webp" alt="Het dorp met het BADI-huis, Traffic Today, de sportschool, het park en de buurttuin" width={2000} height={1131} sizes="(max-width: 512px) 100vw, 512px" className="h-auto w-full" priority />
      </section>

      <section aria-label="De squad">
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">De squad</h2>
        <ul className="grid grid-cols-3 gap-2">
          {others.map((m) => {
            const key = seen.get(m.user_id)?.sprite ?? worldSpriteFor(m.profile.display_name);
            const them = firstName(m.profile.display_name);
            return (
              <li key={m.user_id} className="flex flex-col items-center rounded-[18px] bg-white/70 px-2 pb-2 pt-1 ring-1 ring-ink/[0.05]">
                {key ? <Image src={`/wereld/poppetjes/${key}/staan-01.png`} alt="" width={120} height={102} className="h-[72px] w-auto" /> : <span className="h-[72px]" aria-hidden />}
                <span className="text-[13px] font-medium text-text">{them}</span>
                <span className="text-[11.5px] text-muted">{seen.has(m.user_id) ? SCENE_NAMES[seen.get(m.user_id)!.scene] ?? "in de wereld" : "nog niet geweest"}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-[12.5px] text-muted">Lopen, binnengaan en achter meubels langs komen in de volgende stap.</p>
    </Page>
  );
}

export default function WorldPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
