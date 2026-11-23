import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ANNOUNCEMENT } from "./announcement";

/** True once Baddy posted the announcement in this squad's chat. */
export async function announcementSent(supabase: SupabaseClient, challengeId: string): Promise<boolean> {
  const { data } = await supabase.from("squad_messages").select("id").eq("challenge_id", challengeId).eq("is_coach", true).eq("body", ANNOUNCEMENT.chat).limit(1);
  return (data ?? []).length > 0;
}
