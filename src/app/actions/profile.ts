"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/data";
import { friendlyError } from "@/lib/errors";
import { isOwnedAvatarPath } from "@/lib/storage";
import { isValidDateKey } from "@/lib/dates";
import type { ActionResult } from "@/lib/types";

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    display_name: z.string().trim().min(1, "Vul een naam in.").max(40, "Maximaal 40 tekens."),
    avatar_path: z.string().optional().default(""),
  });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  const avatar = parsed.data.avatar_path || null;
  if (avatar && !isOwnedAvatarPath(avatar, ctx.userId)) return { ok: false, error: "Ongeldige avatar." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: parsed.data.display_name, avatar_path: avatar }).eq("id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  if (ctx.profile.avatar_path && ctx.profile.avatar_path !== avatar) {
    await supabase.storage.from("avatars").remove([ctx.profile.avatar_path]);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addAlcoholException(formData: FormData): Promise<ActionResult> {
  const date = String(formData.get("exception_date") ?? "");
  if (!isValidDateKey(date)) return { ok: false, error: "Kies een geldige datum." };
  const ctx = await requireContext();
  if (date < ctx.challenge.start_date || date > ctx.challenge.end_date) return { ok: false, error: "Kies een datum binnen de Winter Arc." };
  const supabase = await createClient();
  const { error } = await supabase.from("alcohol_exceptions").insert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, exception_date: date });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/profile");
  return { ok: true };
}

export async function removeAlcoholException(formData: FormData): Promise<ActionResult> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Onbekend moment." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("alcohol_exceptions").delete().eq("id", id.data).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/profile");
  return { ok: true };
}
