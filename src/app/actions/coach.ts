"use server";

import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

/** Removes the member's own conversation with Baddy. Recipes and plans Baddy made stay. */
export async function clearCoachConversation(): Promise<ActionResult> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("coach_messages").delete().eq("user_id", ctx.userId);
  if (error) return { ok: false, error: "Wissen is niet gelukt." };
  revalidatePath("/coach");
  return { ok: true };
}
