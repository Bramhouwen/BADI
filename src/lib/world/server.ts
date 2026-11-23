import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AppContext } from "@/lib/data";
import { newWorldProfile, type WorldProfile } from "./types";

const BASE = "user_id, challenge_id, sprite, scene, x, y, updated_at";
// `activity` comes with migration 0031; until it is applied, read without it.
const COLUMNS = `${BASE}, activity`;
const missingColumn = (e: { code?: string } | null) => e?.code === "42703" || e?.code === "PGRST204";

/**
 * Your world profile, created on your first visit. Returns null when the
 * table does not exist yet (migration 0030 not applied), so the page can say so.
 */
export async function ensureWorldProfile(ctx: AppContext): Promise<{ profile: WorldProfile | null; missingTable: boolean }> {
  const supabase = await createClient();
  let { data, error }: { data: unknown; error: { code?: string } | null } = await supabase.from("world_profiles").select(COLUMNS).eq("user_id", ctx.userId).maybeSingle();
  if (missingColumn(error)) ({ data, error } = await supabase.from("world_profiles").select(BASE).eq("user_id", ctx.userId).maybeSingle());
  if (error) return { profile: null, missingTable: true };
  if (data) return { profile: data as WorldProfile, missingTable: false };
  const fresh = newWorldProfile(ctx.userId, ctx.challenge.id, ctx.profile.display_name);
  const { data: created, error: insertError } = await supabase.from("world_profiles").insert(fresh).select(BASE).single();
  if (insertError || !created) return { profile: null, missingTable: Boolean(insertError) };
  return { profile: created as WorldProfile, missingTable: false };
}

/** Everyone's world profile in your group. */
export async function loadWorldProfiles(challengeId: string): Promise<WorldProfile[]> {
  const supabase = await createClient();
  let { data, error }: { data: unknown[] | null; error: { code?: string } | null } = await supabase.from("world_profiles").select(COLUMNS).eq("challenge_id", challengeId);
  if (missingColumn(error)) ({ data, error } = await supabase.from("world_profiles").select(BASE).eq("challenge_id", challengeId));
  return (data ?? []) as WorldProfile[];
}
