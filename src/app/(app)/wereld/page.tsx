import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/data";
import { ensureWorldProfile } from "@/lib/world/server";
import { WORLD_SPRITES, canSeeWorld, worldSpriteFor } from "@/lib/world/types";
import { FIRST_SCENE, SCENES } from "@/lib/world/scenes";
import { firstName } from "@/lib/utils";
import { Page } from "@/components/ui/page";
import { WorldView } from "@/components/world/world-view";

export const metadata = { title: "Wereld" };

/**
 * BADI Wereld over the whole screen: the living room, outside, Traffic Today
 * and the gym, linked by doors. You start where you were last. /wereld?debug=1 shows the walking
 * grid and frames per second; ?debug=2 only enables the test hook
 * window.__wereld; ?scene=kantoor (with debug or bewerken) starts in a scene. ?bewerken is the placement mode for seats
 * (admin only, saves to the scene's JSON on your own computer). See
 * docs/wereld/WERELD.md.
 */
async function Content({ searchParams }: { searchParams: Promise<{ debug?: string | string[]; als?: string | string[]; bewerken?: string | string[]; scene?: string | string[] }> }) {
  const [ctx, sp] = await Promise.all([requireContext(), searchParams]);
  // Only the admin sees the world while it is being built (WORLD_OPEN in src/lib/world/types.ts).
  if (!canSeeWorld(ctx.membership.role)) notFound();
  const { profile, missingTable } = await ensureWorldProfile(ctx);
  const name = firstName(ctx.profile.display_name);
  // Debug only: ?debug=2&als=anne plays as another character to test poses.
  const debugAs = sp.debug && typeof sp.als === "string" && (WORLD_SPRITES as readonly string[]).includes(sp.als) ? sp.als : null;
  const sprite = debugAs ?? profile?.sprite ?? worldSpriteFor(ctx.profile.display_name);
  const testing = sp.debug !== undefined || sp.bewerken !== undefined;
  const jump = testing && typeof sp.scene === "string" && SCENES[sp.scene] ? sp.scene : null;
  const startScene = jump ?? (profile?.scene && SCENES[profile.scene] ? profile.scene : FIRST_SCENE);
  const atSaved = !jump && profile?.scene === startScene && profile.x !== null && profile.y !== null;

  return sprite ? (
    <WorldView
      me={{ id: ctx.userId, name, character: sprite }}
      startScene={startScene}
      startX={atSaved ? profile!.x : null}
      startY={atSaved ? profile!.y : null}
      debug={sp.debug === "1" || sp.debug === "2"}
      overlay={sp.debug === "1"}
      edit={sp.bewerken !== undefined}
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
