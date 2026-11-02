"use server";

import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { SHARING_OPTIONS, sharingToRow, type SharingFlags } from "@/lib/squad-stats";
import type { ActionResult } from "@/lib/types";

/** Saves the user's "Mijn Squad zichtbaarheid" switches. Takes effect immediately: readers evaluate them live. */
export async function updateSharing(formData: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const flags = Object.fromEntries(SHARING_OPTIONS.map((o) => [o.key, formData.get(o.key) === "on"])) as SharingFlags;
  const { error } = await supabase
    .from("stat_sharing")
    .upsert({ user_id: ctx.userId, ...sharingToRow(flags) }, { onConflict: "user_id" });
  if (error) return { ok: false, error: "Instellingen opslaan is niet gelukt." };
  revalidatePath("/profile");
  revalidatePath("/squad");
  revalidatePath("/", "layout");
  return { ok: true };
}
