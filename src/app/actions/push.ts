"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { NOTIFICATION_KINDS } from "@/lib/notification-kinds";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Stores this device's push subscription for the signed-in member. */
export async function savePushSubscription(sub: unknown): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(sub);
  if (!parsed.success) return { ok: false, error: "Deze browser gaf geen geldige inschrijving terug." };
  const ctx = await requireContext();
  const supabase = await createClient();
  // One device can only belong to one member: replace an older row for the same endpoint.
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint).eq("user_id", ctx.userId);
  const { error } = await supabase.from("push_subscriptions").insert({
    challenge_id: ctx.challenge.id,
    user_id: ctx.userId,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
  });
  if (error) return { ok: false, error: "Meldingen aanzetten is niet gelukt." };
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  if (!endpoint || endpoint.length > 1000) return { ok: false, error: "Onbekend apparaat." };
  const ctx = await requireContext();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", ctx.userId);
  return { ok: true };
}

export async function updateNotificationSetting(kind: string, on: boolean): Promise<ActionResult> {
  const k = z.enum(NOTIFICATION_KINDS).safeParse(kind);
  if (!k.success || typeof on !== "boolean") return { ok: false, error: "Onbekende instelling." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("notification_settings").upsert({ user_id: ctx.userId, [k.data]: on, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, error: "Opslaan is niet gelukt." };
  revalidatePath("/profile");
  return { ok: true };
}
