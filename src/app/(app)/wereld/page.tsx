import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSquad, requireContext } from "@/lib/data";
import { ensureWorldProfile, loadWorldProfiles } from "@/lib/world/server";
import { WORLD_SPRITES, canSeeWorld, worldSpriteFor } from "@/lib/world/types";
import { FIRST_SCENE, SCENES } from "@/lib/world/scenes";
import { roomId } from "@/lib/world/scenes/kamers";
import { firstName } from "@/lib/utils";
import { Page } from "@/components/ui/page";
import { WorldView } from "@/components/world/world-view";
import type { WorldMember } from "@/components/world/world-canvas";

export const metadata = { title: "World of Badi" };

/**
 * World of Badi over the whole screen: the living room, outside, Traffic Today
 * and the gym, linked by doors. You start where you were last, and see the
 * others live (or where they were last, while offline). /wereld?debug=1 shows the walking
 * grid and frames per second; ?debug=2 only enables the test hook
 * window.__wereld; ?scene=kantoor (with debug or bewerken) starts in a scene. ?bewerken is the placement mode for seats
 * (admin only, saves to the scene's JSON on your own computer). See
 * docs/wereld/WERELD.md.
 */
async function Content({ searchParams }: { searchParams: Promise<{ debug?: string | string[]; als?: string | string[]; bewerken?: string | string[]; scene?: string | string[]; rondleiding?: string | string[] }> }) {
  const [ctx, sp] = await Promise.all([requireContext(), searchParams]);
  // Only the admin sees the world while it is being built (WORLD_OPEN in src/lib/world/types.ts).
  if (!canSeeWorld(ctx.membership.role)) notFound();
  const [{ profile, missingTable }, squad, all] = await Promise.all([ensureWorldProfile(ctx), getSquad(ctx.challenge.id), loadWorldProfiles(ctx.challenge.id)]);
  // The others, with where they were last: shown in a rest pose while they are offline.
  const byUser = new Map(all.map((p) => [p.user_id, p]));
  const members: WorldMember[] = squad
    .filter((m) => m.user_id !== ctx.userId)
    .flatMap((m) => {
      const p = byUser.get(m.user_id);
      const character = p?.sprite ?? worldSpriteFor(m.profile.display_name);
      if (!character) return [];
      return [{ id: m.user_id, name: firstName(m.profile.display_name), character, scene: p?.scene ?? "", x: p?.x ?? null, y: p?.y ?? null, activity: p?.activity ?? null, updatedAt: p?.updated_at ?? "" }];
    });
  const name = firstName(ctx.profile.display_name);
  // Debug only: ?debug=2&als=anne plays as another character to test poses.
  const debugAs = sp.debug && typeof sp.als === "string" && (WORLD_SPRITES as readonly string[]).includes(sp.als) ? sp.als : null;
  const sprite = debugAs ?? profile?.sprite ?? worldSpriteFor(ctx.profile.display_name);
  // ?scene=kantoor starts in a place (the map on Squad links here); ?scene=jouw-kamer is your own room.
  const asked = typeof sp.scene === "string" ? (sp.scene === "jouw-kamer" && sprite ? roomId(sprite) : sp.scene) : null;
  const jump = asked && SCENES[asked] ? asked : null;
  const startScene = jump ?? (profile?.scene && SCENES[profile.scene] ? profile.scene : FIRST_SCENE);
  const atSaved = !jump && profile?.scene === startScene && profile.x !== null && profile.y !== null;

  return sprite ? (
    <WorldView
      me={{ id: ctx.userId, name, character: sprite }}
      challengeId={ctx.challenge.id}
      startScene={startScene}
      startX={atSaved ? profile!.x : null}
      startY={atSaved ? profile!.y : null}
      restore={atSaved ? (profile!.activity ?? null) : null}
      members={members}
      debug={sp.debug === "1" || sp.debug === "2"}
      overlay={sp.debug === "1"}
      edit={sp.bewerken !== undefined}
      tour={sp.rondleiding !== undefined}
      notice={missingTable ? "Je plek wordt nog niet bewaard (migratie 0030)" : null}
    />
  ) : (
    <Page>
      <p className="rounded-[20px] bg-white/80 p-4 text-[14px] text-muted">Je poppetje voor de wereld is er nog niet.</p>
    </Page>
  );
}

export default function WorldPage({ searchParams }: PageProps<"/wereld">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-40 bg-[#f6ece4]" aria-label="De wereld laadt" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
