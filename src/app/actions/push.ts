"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { NOTIFICATION_KINDS } from "@/lib/notification-kinds";
import { pushConfigured, sendToSubscriptions, type PushSubscriptionKeys } from "@/lib/push";
import { dailyMessage } from "@/lib/coach/daily";
import { todayKey } from "@/lib/dates";
import { firstName } from "@/lib/utils";
import type { TrainingKind } from "@/lib/checkin-plan";

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

/** Sends Baddy's morning or evening message to your own devices right away, with your real data. */
export async function sendCoachTestPush(slot: "morning" | "evening"): Promise<ActionResult<{ devices: number }>> {
  if (slot !== "morning" && slot !== "evening") return { ok: false, error: "Onbekend moment." };
  if (!pushConfigured()) return { ok: false, error: "Pushmeldingen zijn nog niet ingesteld." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const [{ data: subs }, { data: checkins }, { data: joker }, { data: planned }] = await Promise.all([
    supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", ctx.userId),
    supabase.from("daily_checkins").select("checkin_date, activities").eq("user_id", ctx.userId).eq("challenge_id", ctx.challenge.id),
    supabase.from("alcohol_exceptions").select("id").eq("user_id", ctx.userId).eq("exception_date", today).maybeSingle(),
    supabase.from("planned_trainings").select("kind").eq("user_id", ctx.userId).eq("plan_date", today),
  ]);
  const rows = (checkins ?? []) as { checkin_date: string; activities: string[] }[];
  const message = dailyMessage(
    {
      userId: ctx.userId,
      firstName: firstName(ctx.profile.display_name),
      today,
      startDate: ctx.challenge.start_date,
      endDate: ctx.challenge.end_date,
      checkinDates: rows.map((r) => r.checkin_date),
      todayActivities: rows.find((r) => r.checkin_date === today)?.activities ?? [],
      jokerToday: Boolean(joker),
      plannedToday: ((planned ?? []) as { kind: TrainingKind }[]).map((p) => p.kind),
    },
    slot,
  );
  const devices = await sendToSubscriptions((subs ?? []) as PushSubscriptionKeys[], { ...message, url: slot === "morning" ? "/" : "/checkin", tag: `coach-test-${slot}`, icon: "/brand/baddy.jpg" });
  if (devices === 0) return { ok: false, error: "Geen apparaat bereikt. Zet eerst meldingen aan op dit apparaat." };
  return { ok: true, data: { devices } };
}
