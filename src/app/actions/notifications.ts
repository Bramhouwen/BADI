"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/data";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";

export async function markNotificationsRead(): Promise<ActionResult> {
  await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notifications_read");
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}
