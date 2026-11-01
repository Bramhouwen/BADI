"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { DEFAULT_CHALLENGE } from "@/lib/constants";
import { getContext } from "@/lib/data";
import type { ActionResult } from "@/lib/types";

export async function createChallenge(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Je bent niet ingelogd." };
  const { error } = await supabase.rpc("create_challenge", {
    p_name: DEFAULT_CHALLENGE.name,
    p_start_date: DEFAULT_CHALLENGE.start_date,
    p_end_date: DEFAULT_CHALLENGE.end_date,
    p_timezone: DEFAULT_CHALLENGE.timezone,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  redirect("/");
}

const tokenSchema = z.string().trim().regex(/^[a-f0-9]{64}$/i, "Dit is geen geldige uitnodigingslink.");

/** Accepts an invitation token (64 hex chars) or a full invitation URL. */
export async function acceptInvitation(formData: FormData): Promise<ActionResult> {
  const raw = String(formData.get("token") ?? "").trim();
  const token = raw.includes("/invite/") ? raw.split("/invite/")[1]?.split(/[?#]/)[0] ?? "" : raw;
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${parsed.data}`)}`);
  const { error } = await supabase.rpc("accept_invitation", { p_token: parsed.data });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  redirect("/?welcome=1");
}

export async function createInvitation(formData: FormData): Promise<ActionResult<{ token: string; url: string }>> {
  const ctx = await getContext();
  if (!ctx) return { ok: false, error: "Je bent niet ingelogd." };
  if (ctx.membership.role !== "admin") return { ok: false, error: "Alleen de beheerder kan uitnodigen." };
  const emailRaw = String(formData.get("email") ?? "").trim();
  const email = emailRaw ? z.string().email().safeParse(emailRaw) : null;
  if (email && !email.success) return { ok: false, error: "Vul een geldig e-mailadres in of laat het leeg." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", { p_invited_email: email?.success ? email.data : null });
  if (error) return { ok: false, error: friendlyError(error) };
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  revalidatePath("/profile/invite");
  return { ok: true, data: { token: data as string, url: `${site}/invite/${data}` } };
}

export async function revokeInvitation(formData: FormData): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx || ctx.membership.role !== "admin") return { ok: false, error: "Alleen de beheerder kan uitnodigingen intrekken." };
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Ongeldige uitnodiging." };
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").delete().eq("id", id.data).eq("challenge_id", ctx.challenge.id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/profile/invite");
  return { ok: true };
}
