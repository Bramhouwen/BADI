import "server-only";

import type { ReactionKey } from "@/lib/constants";
import { getSquad, type AppContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrlMap } from "@/lib/storage";
import type { PostReaction, WallPost } from "@/lib/types";
import type { PostCardData } from "./post-card";

export async function loadPosts(ctx: AppContext, opts: { id?: string; limit?: number } = {}): Promise<PostCardData[]> {
  const supabase = await createClient();
  let q = supabase.from("wall_posts").select("*").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false });
  if (opts.id) q = q.eq("id", opts.id);
  if (opts.limit) q = q.limit(opts.limit);
  const [squad, { data: postRows }] = await Promise.all([getSquad(ctx.challenge.id), q]);
  const posts = (postRows ?? []) as WallPost[];
  if (posts.length === 0) return [];
  const { data: reactionRows } = await supabase
    .from("post_reactions")
    .select("post_id, user_id, reaction")
    .in("post_id", posts.map((p) => p.id));
  const reactions = (reactionRows ?? []) as Pick<PostReaction, "post_id" | "user_id" | "reaction">[];
  const [images, avatars] = await Promise.all([
    signedUrlMap("wall", posts.map((p) => p.image_path)),
    signedUrlMap("avatars", squad.map((m) => m.profile.avatar_path).filter((p): p is string => Boolean(p))),
  ]);
  return posts.map((p) => {
    const author = squad.find((m) => m.user_id === p.user_id)?.profile;
    const mine = reactions.filter((r) => r.post_id === p.id);
    const counts: Partial<Record<ReactionKey, number>> = {};
    for (const r of mine) counts[r.reaction] = (counts[r.reaction] ?? 0) + 1;
    return {
      id: p.id,
      imageUrl: images.get(p.image_path) ?? null,
      caption: p.caption,
      created_at: p.created_at,
      author: { name: author?.display_name ?? "Lid", avatar: author?.avatar_path ? avatars.get(author.avatar_path) ?? null : null },
      isOwner: p.user_id === ctx.userId,
      reactions: { counts, mine: mine.find((r) => r.user_id === ctx.userId)?.reaction ?? null },
    };
  });
}
