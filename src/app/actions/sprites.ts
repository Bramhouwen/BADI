"use server";

import { revalidatePath } from "next/cache";
import { getSquad, requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { pushConfigured, sendPush, sendToSubscriptions, type PushSubscriptionKeys } from "@/lib/push";
import { SPRITE_SHEETS, SPRITES_LIVE, spriteKey } from "@/lib/sprites";
import { OWN_SPRITE_PREVIEW, ownSpriteIntro } from "@/lib/announcement";
import { firstName } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";

async function requireAdmin() {
  const ctx = await requireContext();
  if (ctx.membership.role !== "admin") throw new Error("NOT_ADMIN");
  return ctx;
}

function validKey(key: string): boolean {
  return /^[a-z0-9-]{1,40}$/.test(key) && SPRITE_SHEETS[key]?.live === false;
}

/** The member's own push, sent to the admin's devices; tapping it opens their introduction. */
export async function sendSpriteTest(key: string): Promise<ActionResult<{ devices: number }>> {
  if (!SPRITES_LIVE) return { ok: false, error: "De poppetjes staan uit (SPRITES_LIVE in src/lib/sprites.ts)." };
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch {
    return { ok: false, error: "Alleen de beheerder kan een test sturen." };
  }
  if (!validKey(key)) return { ok: false, error: "Onbekend poppetje." };
  if (!pushConfigured()) return { ok: false, error: "Pushmeldingen zijn hier niet ingesteld." };
  const supabase = await createClient();
  const { data } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", ctx.userId);
  const subs = (data ?? []) as PushSubscriptionKeys[];
  if (subs.length === 0) return { ok: false, error: "Op jouw account staan geen meldingen aan. Zet ze aan bij Meldingen hieronder en probeer opnieuw." };
  const intro = ownSpriteIntro(key);
  const devices = await sendToSubscriptions(subs, { ...intro.push, url: `/?${OWN_SPRITE_PREVIEW}=${key}`, tag: `own-sprite-test-${key}`, icon: SPRITE_SHEETS[key].face });
  if (devices === 0) return { ok: false, error: "De melding kwam niet aan. Zet meldingen op je telefoon opnieuw aan en probeer het nog eens." };
  return { ok: true, data: { devices } };
}

/** Releases a member's character: it goes live for everyone and its member gets a push. Once only. */
export async function releaseSprite(key: string): Promise<ActionResult> {
  if (!SPRITES_LIVE) return { ok: false, error: "De poppetjes staan uit (SPRITES_LIVE in src/lib/sprites.ts)." };
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch {
    return { ok: false, error: "Alleen de beheerder kan poppetjes vrijgeven." };
  }
  if (!validKey(key)) return { ok: false, error: "Onbekend poppetje." };
  const squad = await getSquad(ctx.challenge.id);
  const member = squad.find((m) => spriteKey(m.profile.display_name) === key);
  if (!member) return { ok: false, error: `Er is geen lid met de voornaam ${key.charAt(0).toUpperCase() + key.slice(1)}.` };
  const supabase = await createClient();
  const { error } = await supabase.from("sprite_releases").insert({ challenge_id: ctx.challenge.id, sprite: key });
  if (error) return { ok: false, error: error.message.includes("duplicate") ? "Dit poppetje is al vrijgegeven." : "Vrijgeven lukte niet. Staat migratie 0029 in Supabase?" };
  if (member.user_id !== ctx.userId) {
    const intro = ownSpriteIntro(firstName(member.profile.display_name));
    await sendPush(supabase, "direct", { ...intro.push, url: "/", tag: `own-sprite-${key}`, icon: SPRITE_SHEETS[key].face }, { only: member.user_id });
  }
  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true };
}
