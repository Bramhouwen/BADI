"use server";

import { revalidatePath } from "next/cache";
import { SPRITE_SHEETS, SPRITES_LIVE } from "@/lib/sprites";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { pushConfigured, sendPush, sendToSubscriptions, type PushSubscriptionKeys } from "@/lib/push";
import { ANNOUNCEMENT, ANNOUNCEMENT_PREVIEW } from "@/lib/announcement";
import { announcementSent } from "@/lib/announcement-server";
import type { ActionResult } from "@/lib/types";

async function requireAdmin() {
  const ctx = await requireContext();
  if (ctx.membership.role !== "admin") throw new Error("NOT_ADMIN");
  return ctx;
}

/** Sends the announcement's push to the admin's own devices only; tapping it opens the preview. */
export async function sendAnnouncementTest(): Promise<ActionResult<{ devices: number }>> {
  if (!SPRITES_LIVE) return { ok: false, error: "De poppetjes staan uit (SPRITES_LIVE in src/lib/sprites.ts)." };
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch {
    return { ok: false, error: "Alleen de beheerder kan een test sturen." };
  }
  if (!pushConfigured()) return { ok: false, error: "Pushmeldingen zijn hier niet ingesteld." };
  const supabase = await createClient();
  const { data } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", ctx.userId);
  const subs = (data ?? []) as PushSubscriptionKeys[];
  if (subs.length === 0) return { ok: false, error: "Op jouw account staan geen meldingen aan. Zet ze aan bij Meldingen hieronder en probeer opnieuw." };
  const devices = await sendToSubscriptions(subs, { ...ANNOUNCEMENT.push, url: `/?${ANNOUNCEMENT_PREVIEW}=1`, tag: "announcement-test", icon: SPRITE_SHEETS[ANNOUNCEMENT.sprite]?.face });
  if (devices === 0) return { ok: false, error: "De melding kwam niet aan. Zet meldingen op je telefoon opnieuw aan en probeer het nog eens." };
  return { ok: true, data: { devices } };
}

/** Baddy posts the announcement in the squad chat and everyone else gets a push. Once only. */
export async function sendAnnouncement(): Promise<ActionResult> {
  if (!SPRITES_LIVE) return { ok: false, error: "De poppetjes staan uit (SPRITES_LIVE in src/lib/sprites.ts)." };
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch {
    return { ok: false, error: "Alleen de beheerder kan dit versturen." };
  }
  const supabase = await createClient();
  if (await announcementSent(supabase, ctx.challenge.id)) return { ok: false, error: "Deze aankondiging is al verstuurd." };
  const { error } = await supabase.from("squad_messages").insert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, body: ANNOUNCEMENT.chat, mentions: [], is_coach: true });
  if (error) return { ok: false, error: "Versturen lukte niet. Probeer het opnieuw." };
  await sendPush(supabase, "chat", { ...ANNOUNCEMENT.push, url: "/", tag: "announcement", icon: SPRITE_SHEETS[ANNOUNCEMENT.sprite]?.face }, { exclude: [ctx.userId] });
  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true };
}
