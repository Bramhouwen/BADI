import { Suspense } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getSquad, requireContext } from "@/lib/data";
import { ensureWorldProfile, loadWorldProfiles } from "@/lib/world/server";
import { WORLD_SPRITES, canSeeWorld, worldSpriteFor } from "@/lib/world/types";
import { WOONKAMER } from "@/lib/world/scenes/woonkamer";
import { firstName } from "@/lib/utils";
import { Page } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { WorldCanvas } from "@/components/world/world-canvas";

export const metadata = { title: "Wereld" };

const SCENE_NAMES: Record<string, string> = {
  buiten: "buiten in het dorp",
  woonkamer: "in de woonkamer",
  kantoor: "bij Traffic Today",
  sportschool: "in de sportschool",
};

/**
 * BADI Wereld. Fase 1a: the living room, where you walk, sit and stand behind
 * furniture. /wereld?debug=1 shows the walking grid; ?debug=2 only enables the
 * test hook window.__wereld. ?bewerken is the placement mode for seats
 * (admin only, saves to the scene's JSON on your own computer). See
 * docs/wereld/WERELD.md.
 */
async function Content({ searchParams }: { searchParams: Promise<{ debug?: string | string[]; als?: string | string[]; bewerken?: string | string[] }> }) {
  const [ctx, sp] = await Promise.all([requireContext(), searchParams]);
  // Only the admin sees the world while it is being built (WORLD_OPEN in src/lib/world/types.ts).
  if (!canSeeWorld(ctx.membership.role)) notFound();
  const [{ profile, missingTable }, squad, all] = await Promise.all([ensureWorldProfile(ctx), getSquad(ctx.challenge.id), loadWorldProfiles(ctx.challenge.id)]);
  const name = firstName(ctx.profile.display_name);
  // Debug only: ?debug=2&als=anne plays as another character to test poses.
  const debugAs = sp.debug && typeof sp.als === "string" && (WORLD_SPRITES as readonly string[]).includes(sp.als) ? sp.als : null;
  const sprite = debugAs ?? profile?.sprite ?? worldSpriteFor(ctx.profile.display_name);
  const inRoom = profile?.scene === WOONKAMER.id && profile.x !== null && profile.y !== null;
  const others = squad.filter((m) => m.user_id !== ctx.userId);
  const seen = new Map(all.map((p) => [p.user_id, p]));

  return (
    <Page className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">BADI Wereld · {WOONKAMER.name}</p>
          <h1 className="truncate font-display text-[28px] leading-tight text-text">{name}</h1>
        </div>
        <p className="shrink-0 pb-1 text-[12.5px] text-muted">{sp.bewerken !== undefined ? "Zitplekken plaatsen" : "Tik om te lopen"}</p>
      </div>

      {sprite ? (
        <WorldCanvas scene={WOONKAMER} me={{ id: ctx.userId, name, character: sprite }} startX={inRoom ? profile!.x : null} startY={inRoom ? profile!.y : null} debug={sp.debug === "1" || sp.debug === "2"} overlay={sp.debug === "1"} edit={sp.bewerken !== undefined} />
      ) : (
        <p className="rounded-[20px] bg-white/80 p-4 text-[14px] text-muted">Je poppetje voor de wereld is er nog niet.</p>
      )}
      {missingTable ? <p className="text-[12.5px] text-muted">Je plek wordt nog niet bewaard: migratie 0030 staat nog niet in Supabase.</p> : null}

      <section aria-label="De squad" className="pt-2">
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">De squad</h2>
        <ul className="grid grid-cols-3 gap-2">
          {others.map((m) => {
            const key = seen.get(m.user_id)?.sprite ?? worldSpriteFor(m.profile.display_name);
            return (
              <li key={m.user_id} className="flex flex-col items-center rounded-[18px] bg-white/70 px-2 pb-2 pt-1 ring-1 ring-ink/[0.05]">
                {key ? <Image src={`/wereld/poppetjes/${key}/staan-01.png`} alt="" width={120} height={102} className="h-[64px] w-auto" /> : <span className="h-[64px]" aria-hidden />}
                <span className="text-[13px] font-medium text-text">{firstName(m.profile.display_name)}</span>
                <span className="text-[11.5px] text-muted">{seen.has(m.user_id) ? SCENE_NAMES[seen.get(m.user_id)!.scene] ?? "in de wereld" : "nog niet geweest"}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </Page>
  );
}

export default function WorldPage({ searchParams }: PageProps<"/wereld">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
