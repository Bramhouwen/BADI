"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/data";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";

const schema = z.object({
  receiver_id: z.string().uuid("Kies een squadlid."),
  message: z.string().trim().min(1, "Schrijf of kies een compliment.").max(140, "Maximaal 140 tekens."),
});

export async function sendCompliment(input: { receiver_id: string; message: string }): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  if (parsed.data.receiver_id === ctx.userId) return { ok: false, error: "Een compliment aan jezelf telt ook, maar stuur het naar een vriend." };
  const supabase = await createClient();
  const { error } = await supabase.from("compliments").insert({
    challenge_id: ctx.challenge.id,
    sender_id: ctx.userId,
    receiver_id: parsed.data.receiver_id,
    message: parsed.data.message,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/squad");
  return { ok: true };
}

export async function markComplimentsRead(): Promise<ActionResult> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("compliments").update({ read_at: new Date().toISOString() }).eq("receiver_id", ctx.userId).is("read_at", null);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/squad");
  return { ok: true };
}
