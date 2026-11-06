"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sendPush } from "@/lib/push";
import { firstName } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/data";
import { todayKey } from "@/lib/dates";
import { weekStartOf } from "@/lib/checkin-plan";
import { friendlyError } from "@/lib/errors";
import { isOwnedMediaPath, signedUrl } from "@/lib/storage";
import { CATEGORY_META, CHALLENGE_META, formatEuro, PRIZE_CATEGORIES, WHEEL_CATEGORIES, type WheelCategory, type WheelChallengeKey } from "@/lib/wheel";
import type { ActionResult } from "@/lib/types";

export interface SpinOutcome {
  spinId: string;
  category: WheelCategory;
  brand: string | null;
  name: string | null;
  description: string | null;
  valueCents: number | null;
  url: string | null;
  image: string | null;
  variantLabel: string | null;
  variants: string[];
  challenge: { key: WheelChallengeKey; title: string; rule: string; mode: "auto" | "manual"; image: string } | null;
}

function revalidateWheel() {
  revalidatePath("/wheel");
  revalidatePath("/wheel/prizes");
  revalidatePath("/wheel/admin");
  revalidatePath("/");
}

/** The spin: the database picks the category and prize and reserves stock. */
export async function spinWheel(): Promise<ActionResult<SpinOutcome>> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("spin_wheel", { p_challenge: ctx.challenge.id });
  if (error || !data) return { ok: false, error: friendlyError(error ?? "Draaien lukte niet.") };
  const spin = (Array.isArray(data) ? data[0] : data) as { id: string; category: WheelCategory; prize_id: string | null; prize_brand: string | null; prize_name: string | null; challenge_key: WheelChallengeKey | null };
  let description: string | null = null;
  let valueCents: number | null = null;
  let url: string | null = null;
  let image: string | null = null;
  let variantLabel: string | null = null;
  let variants: string[] = [];
  if (spin.prize_id) {
    const { data: prize } = await supabase.from("prizes").select("description, value_cents, url, image_path, variant_label, variants").eq("id", spin.prize_id).maybeSingle();
    description = (prize?.description as string | null) ?? null;
    valueCents = (prize?.value_cents as number | null) ?? null;
    url = (prize?.url as string | null) ?? null;
    variants = (prize?.variants as string[] | null) ?? [];
    variantLabel = variants.length ? ((prize?.variant_label as string | null) ?? "Keuze") : null;
    // Shared with the squad right away, as a message from Baddy in the group chat.
    const who = firstName(ctx.profile.display_name);
    const worth = valueCents ? ` (t.w.v. ${formatEuro(valueCents)})` : "";
    const body =
      spin.category === "jackpot"
        ? `👑 JACKPOT! ${who} heeft ${spin.prize_brand} ${spin.prize_name}${worth} gewonnen met het Weekrad!`
        : `🎉 ${who} heeft ${spin.prize_brand} ${spin.prize_name}${worth} gewonnen met het Weekrad!`;
    after(async () => {
      await supabase.from("squad_messages").insert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, body, mentions: [], is_coach: true });
      await sendPush(supabase, "chat", { title: "Weekrad", body, url: "/squad/chat", tag: "squad-chat" }, { exclude: [ctx.userId] });
    });
    image = prize?.image_path ? await signedUrl("prizes", prize.image_path as string) : null;
  }
  // No revalidate here: the page would show the result before the wheel stops.
  // The wheel refreshes the page itself after the reveal.
  return {
    ok: true,
    data: {
      spinId: spin.id,
      category: spin.category,
      brand: spin.prize_brand,
      name: spin.prize_name,
      description,
      valueCents,
      url,
      image,
      variantLabel,
      variants,
      challenge: spin.challenge_key ? { key: spin.challenge_key, ...CHALLENGE_META[spin.challenge_key] } : null,
    },
  };
}

export async function claimPrize(spinId: string, variant: string | null): Promise<ActionResult> {
  await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_prize", { p_spin: spinId, p_variant: variant });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateWheel();
  return { ok: true };
}

/* --------------------------------------------------------------------------
 * Admin
 * ------------------------------------------------------------------------ */

async function requireAdmin() {
  const ctx = await requireContext();
  if (ctx.membership.role !== "admin") throw new Error("NOT_ADMIN");
  return ctx;
}

const prizeSchema = z.object({
  id: z.string().optional().default(""),
  category: z.enum(PRIZE_CATEGORIES as [string, ...string[]]),
  brand: z.string().trim().min(1, "Vul een merk in.").max(60, "Maximaal 60 tekens."),
  name: z.string().trim().min(1, "Vul een productnaam in.").max(80, "Maximaal 80 tekens."),
  description: z.string().trim().max(600, "Introductie: maximaal 600 tekens.").optional().default(""),
  url: z
    .string()
    .trim()
    .max(300, "Link is te lang.")
    .optional()
    .default("")
    .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
    .refine((v) => v === "" || /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(v), "Dat is geen geldige link."),
  image_path: z.string().optional().default(""),
  variant_label: z.string().trim().max(30).optional().default(""),
  variants: z.string().trim().max(400).optional().default(""),
  needs_code: z.string().optional(),
  stock: z.coerce.number().int("Voorraad in hele stuks.").min(0).max(10_000),
  weekly_max: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 100), "Maximum per week: een heel getal vanaf 1, of leeg."),
  value: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((v) => (v === "" ? null : Math.round(Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v) * 100)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 10_000_000), "Waarde in euro, bijvoorbeeld 25 of 12,50."),
  cost: z
    .string()
    .trim()
    .optional()
    .default("")
    // "12,50", "1.234,50" or "12.50".
    .transform((v) => (v === "" ? 0 : Math.round(Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v) * 100)))
    .refine((v) => Number.isFinite(v) && v >= 0 && v <= 10_000_000, "Kosten in euro, bijvoorbeeld 12,50."),
  sponsored: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((v) => (v === "" ? 0 : Math.round(Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v) * 100)))
    .refine((v) => Number.isFinite(v) && v >= 0 && v <= 10_000_000, "Gesponsord in euro, bijvoorbeeld 5 of 4,50."),
  shipping: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((v) => (v === "" ? 0 : Math.round(Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v) * 100)))
    .refine((v) => Number.isFinite(v) && v >= 0 && v <= 10_000_000, "Verzendkosten in euro, bijvoorbeeld 4,95."),
  weight: z.coerce.number().int("Gewicht: een heel getal.").min(1, "Gewicht: minimaal 1.").max(100, "Gewicht: maximaal 100."),
  active: z.string().optional(),
});

export async function savePrize(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = prizeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch {
    return { ok: false, error: "Alleen de beheerder kan prijzen beheren." };
  }
  const d = parsed.data;
  if (d.image_path && !isOwnedMediaPath(d.image_path, ctx.challenge.id, ctx.userId) && !d.image_path.startsWith(`${ctx.challenge.id}/`)) return { ok: false, error: "Ongeldige foto." };
  const variants = d.variants
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 20);
  const row = {
    category: d.category,
    brand: d.brand,
    name: d.name,
    description: d.description || null,
    url: d.url || null,
    value_cents: d.value,
    image_path: d.image_path || null,
    variant_label: variants.length ? d.variant_label || "Keuze" : d.variant_label || null,
    variants,
    needs_code: d.needs_code === "on",
    stock: d.stock,
    weekly_max: d.weekly_max,
    cost_cents: d.cost,
    sponsored_cents: d.sponsored,
    shipping_cents: d.shipping,
    weight: d.weight,
    active: d.active === "on",
    updated_at: new Date().toISOString(),
  };
  const supabase = await createClient();
  const res = d.id
    ? await supabase.from("prizes").update(row).eq("id", d.id).eq("challenge_id", ctx.challenge.id).select("id").single()
    : await supabase.from("prizes").insert({ ...row, challenge_id: ctx.challenge.id }).select("id").single();
  if (res.error) return { ok: false, error: friendlyError(res.error) };
  revalidateWheel();
  return { ok: true, data: { id: res.data.id as string } };
}

export async function deletePrize(id: string): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch {
    return { ok: false, error: "Alleen de beheerder kan prijzen beheren." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("prizes").delete().eq("id", id).eq("challenge_id", ctx.challenge.id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateWheel();
  return { ok: true };
}

export async function saveWeights(formData: FormData): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch {
    return { ok: false, error: "Alleen de beheerder kan de kansen aanpassen." };
  }
  const rows = WHEEL_CATEGORIES.map((key) => ({ key, weight: Number(formData.get(key)) }));
  const bad = rows.find((r) => !Number.isInteger(r.weight) || r.weight < 0 || r.weight > 100);
  if (bad) return { ok: false, error: `${CATEGORY_META[bad.key].label}: een heel getal van 0 tot 100.` };
  if (rows.every((r) => r.weight === 0)) return { ok: false, error: "Minstens één categorie moet een kans hebben." };
  const supabase = await createClient();
  for (const r of rows) {
    const { error } = await supabase.from("wheel_categories").update({ weight: r.weight }).eq("challenge_id", ctx.challenge.id).eq("key", r.key);
    if (error) return { ok: false, error: friendlyError(error) };
  }
  revalidateWheel();
  return { ok: true };
}

const STATUS_FLOW = ["claimed", "ordered", "delivered"] as const;

export async function setSpinStatus(spinId: string, status: (typeof STATUS_FLOW)[number]): Promise<ActionResult> {
  if (!STATUS_FLOW.includes(status)) return { ok: false, error: "Onbekende status." };
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch {
    return { ok: false, error: "Alleen de beheerder kan de status aanpassen." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("wheel_spins")
    .update({ status, delivered_at: status === "delivered" ? new Date().toISOString() : null })
    .eq("id", spinId)
    .eq("challenge_id", ctx.challenge.id)
    .neq("status", "challenge");
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateWheel();
  return { ok: true };
}

export async function setGiftCode(spinId: string, code: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Alleen de beheerder kan codes toevoegen." };
  }
  const clean = code.trim();
  if (clean.length > 120) return { ok: false, error: "Maximaal 120 tekens." };
  const supabase = await createClient();
  const { error } = clean
    ? await supabase.from("wheel_codes").upsert({ spin_id: spinId, code: clean }, { onConflict: "spin_id" })
    : await supabase.from("wheel_codes").delete().eq("spin_id", spinId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateWheel();
  return { ok: true };
}


export async function saveBudget(formData: FormData): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch {
    return { ok: false, error: "Alleen de beheerder kan het budget instellen." };
  }
  const raw = String(formData.get("budget") ?? "").trim();
  const period = formData.get("period") === "week" ? "week" : "month";
  const cents = raw === "" ? null : Math.round(Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw) * 100);
  if (cents !== null && (!Number.isFinite(cents) || cents < 0 || cents > 100_000_000)) return { ok: false, error: "Budget in euro, bijvoorbeeld 150, of leeg voor geen budget." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("wheel_settings")
    .upsert({ challenge_id: ctx.challenge.id, budget_cents: cents, budget_period: period, updated_at: new Date().toISOString() }, { onConflict: "challenge_id" });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateWheel();
  return { ok: true };
}

/** Marks a manual extra challenge (energizer, lunch, relax) as done, in the week it was spun. */
export async function completeChallenge(spinId: string): Promise<ActionResult> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data: spin } = await supabase.from("wheel_spins").select("id, user_id, week_start, challenge_key, challenge_completed_at").eq("id", spinId).eq("user_id", ctx.userId).maybeSingle();
  if (!spin || !spin.challenge_key) return { ok: false, error: "Deze challenge bestaat niet." };
  if (CHALLENGE_META[spin.challenge_key as WheelChallengeKey]?.mode !== "manual") return { ok: false, error: "Deze challenge houdt de app zelf bij." };
  const today = todayKey(new Date(), ctx.challenge.timezone);
  if (weekStartOf(today) !== spin.week_start) return { ok: false, error: "Deze week is voorbij." };
  const { error } = await supabase.rpc("complete_wheel_challenge", { p_spin: spinId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateWheel();
  return { ok: true };
}
