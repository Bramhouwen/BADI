"use server";

import { z } from "zod";
import { canSeeWorld } from "@/lib/world/types";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const schema = z.object({
  scene: z.string().regex(/^[a-z0-9-]{1,40}$/),
  x: z.number().finite().min(0).max(10000),
  y: z.number().finite().min(0).max(10000),
});

/** Remembers where you are in the world (scene and the spot of your feet in its background). */
export async function saveWorldPosition(input: { scene: string; x: number; y: number }): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Onbekende plek." };
  const ctx = await requireContext();
  if (!canSeeWorld(ctx.membership.role)) return { ok: false, error: "De wereld is nog niet open." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("world_profiles")
    .update({ scene: parsed.data.scene, x: Math.round(parsed.data.x), y: Math.round(parsed.data.y), updated_at: new Date().toISOString() })
    .eq("user_id", ctx.userId);
  return error ? { ok: false, error: "Je plek is niet bewaard." } : { ok: true };
}
