import "server-only";

import { createClient } from "@/lib/supabase/server";
import { parseMemberStats, sharingFromRow, type MemberStatsPayload, type SharingFlags } from "@/lib/squad-stats";
import { parseMemberHabits, type HabitWithDates } from "@/lib/habits";

/**
 * Shared statistics of one squad member. The database applies the member's
 * sharing settings and the squad-membership check; a refusal yields null.
 */
export async function loadMemberStats(userId: string): Promise<MemberStatsPayload | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("squad_member_stats", { p_user: userId });
  if (error) return null;
  return parseMemberStats(data);
}

/** The signed-in user's own sharing switches. */
export async function loadSharing(userId: string): Promise<SharingFlags> {
  const supabase = await createClient();
  const { data } = await supabase.from("stat_sharing").select("*").eq("user_id", userId).maybeSingle();
  return sharingFromRow((data ?? null) as Record<string, unknown> | null);
}

/** Own habits of a member with ticked days in a range; the database checks the habits switch. */
export async function loadMemberHabits(userId: string, from: string, to: string): Promise<{ shared: boolean; habits: HabitWithDates[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("member_habits", { p_user: userId, p_from: from, p_to: to });
  if (error) return { shared: false, habits: [] };
  return parseMemberHabits(data);
}
