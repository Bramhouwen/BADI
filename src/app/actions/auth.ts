"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function safeNext(next: unknown): string {
  const s = typeof next === "string" ? next : "/";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

const emailSchema = z.string().trim().email("Vul een geldig e-mailadres in.");

export async function sendMagicLink(formData: FormData): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}

export async function signInWithPassword(formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    email: emailSchema,
    password: z.string().min(1, "Vul je wachtwoord in."),
  });
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: friendlyError(error) };
  redirect(safeNext(formData.get("next")));
}

export async function signUpWithPassword(formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    email: emailSchema,
    password: z.string().min(8, "Kies een wachtwoord van minimaal 8 tekens."),
    display_name: z.string().trim().min(1, "Hoe mogen we je noemen?").max(40, "Maximaal 40 tekens."),
  });
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    display_name: formData.get("display_name"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.display_name },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { ok: false, error: friendlyError(error) };
  // With e-mail confirmation enabled there is no session yet.
  if (!data.session) return { ok: true, data: undefined };
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
