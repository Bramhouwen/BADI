"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/data";
import { friendlyError } from "@/lib/errors";
import { isOwnedMediaPath } from "@/lib/storage";
import { REACTION_KEYS, type ReactionKey } from "@/lib/constants";
import type { ActionResult } from "@/lib/types";

const postSchema = z.object({
  image_path: z.string().min(1, "Een foto is verplicht op de Wall."),
  caption: z.string().trim().max(500, "Maximaal 500 tekens.").optional().default(""),
});

export async function createPost(formData: FormData): Promise<ActionResult> {
  const parsed = postSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  if (!isOwnedMediaPath(parsed.data.image_path, ctx.challenge.id, ctx.userId)) return { ok: false, error: "Ongeldige foto." };
  const supabase = await createClient();
  const { error } = await supabase.from("wall_posts").insert({
    challenge_id: ctx.challenge.id,
    user_id: ctx.userId,
    image_path: parsed.data.image_path,
    caption: parsed.data.caption || null,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/wall");
  revalidatePath("/");
  redirect("/wall?posted=1");
}

export async function updateCaption(postId: string, formData: FormData): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(postId).success) return { ok: false, error: "Onbekende post." };
  const caption = z.string().trim().max(500, "Maximaal 500 tekens.").safeParse(formData.get("caption") ?? "");
  if (!caption.success) return { ok: false, error: caption.error.issues[0].message };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("wall_posts").update({ caption: caption.data || null }).eq("id", postId).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/wall");
  revalidatePath(`/wall/${postId}`);
  return { ok: true };
}

export async function deletePost(postId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(postId).success) return { ok: false, error: "Onbekende post." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data: post } = await supabase.from("wall_posts").select("image_path").eq("id", postId).eq("user_id", ctx.userId).maybeSingle();
  if (!post) return { ok: false, error: "Je kunt alleen je eigen posts verwijderen." };
  const { error } = await supabase.from("wall_posts").delete().eq("id", postId).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  await supabase.storage.from("wall").remove([post.image_path as string]);
  revalidatePath("/wall");
  revalidatePath("/");
  redirect("/wall");
}

export async function setReaction(postId: string, reaction: ReactionKey | null): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(postId).success) return { ok: false, error: "Onbekende post." };
  if (reaction !== null && !REACTION_KEYS.includes(reaction)) return { ok: false, error: "Onbekende reactie." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = reaction
    ? await supabase.from("post_reactions").upsert({ post_id: postId, user_id: ctx.userId, reaction }, { onConflict: "post_id,user_id" })
    : await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/wall");
  revalidatePath(`/wall/${postId}`);
  return { ok: true };
}
