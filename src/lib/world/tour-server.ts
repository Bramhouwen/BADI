import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { WORLD_TOUR } from "./tour";

/** True once Baddy posted the World of Badi announcement in this squad's chat. */
export async function worldTourSent(supabase: SupabaseClient, challengeId: string): Promise<boolean> {
  const { data } = await supabase.from("squad_messages").select("id").eq("challenge_id", challengeId).eq("is_coach", true).eq("body", WORLD_TOUR.chat).limit(1);
  return (data ?? []).length > 0;
}
