"use server";

import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { pushConfigured, sendPush, sendToSubscriptions, type PushSubscriptionKeys } from "@/lib/push";
import { WORLD_OPEN } from "@/lib/world/types";
import { TOUR_URL, WORLD_TOUR } from "@/lib/world/tour";
import { worldTourSent } from "@/lib/world/tour-server";
import type { ActionResult } from "@/lib/types";

async function requireAdmin() {
  const ctx = await requireContext();
  if (ctx.membership.role !== "admin") throw new Error("NOT_ADMIN");
  return ctx;
}

/** The push of the World of Badi announcement, to the admin's own devices only; tapping it opens the tour. */
export async function sendWorldTourTest(): Promise<ActionResult<{ devices: number }>> {
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
  const devices = await sendToSubscriptions(subs, { ...WORLD_TOUR.push, url: TOUR_URL, tag: "world-tour-test" });
  if (devices === 0) return { ok: false, error: "De melding kwam niet aan. Zet meldingen op je telefoon opnieuw aan en probeer het nog eens." };
  return { ok: true, data: { devices } };
}

/** Baddy posts World of Badi in the squad chat and everyone else gets a push to the tour. Once only, and only when the world is open. */
export async function sendWorldTour(): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch {
    return { ok: false, error: "Alleen de beheerder kan dit versturen." };
  }
  if (!WORLD_OPEN) return { ok: false, error: "De wereld staat nog alleen voor jou open. Zet eerst WORLD_OPEN aan (src/lib/world/types.ts)." };
  const supabase = await createClient();
  if (await worldTourSent(supabase, ctx.challenge.id)) return { ok: false, error: "Deze aankondiging is al verstuurd." };
  const { error } = await supabase.from("squad_messages").insert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, body: WORLD_TOUR.chat, mentions: [], is_coach: true });
  if (error) return { ok: false, error: "Versturen lukte niet. Probeer het opnieuw." };
  await sendPush(supabase, "chat", { ...WORLD_TOUR.push, url: TOUR_URL, tag: "world-tour" }, { exclude: [ctx.userId] });
  revalidatePath("/profile");
  revalidatePath("/squad");
  return { ok: true };
}
