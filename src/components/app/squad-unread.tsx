import { getContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/** Small dot on the Squad tab while there are chat messages the user has not seen. */
export async function SquadUnreadDot() {
  const ctx = await getContext();
  if (!ctx) return null;
  const supabase = await createClient();
  const { data: read } = await supabase.from("squad_chat_reads").select("last_read_at").eq("challenge_id", ctx.challenge.id).eq("user_id", ctx.userId).maybeSingle();
  let q = supabase.from("squad_messages").select("id", { count: "exact", head: true }).eq("challenge_id", ctx.challenge.id).is("recipient_id", null).neq("user_id", ctx.userId);
  const lastRead = (read as { last_read_at?: string } | null)?.last_read_at;
  if (lastRead) q = q.gt("created_at", lastRead);
  const [{ count: groupCount }, { data: toMe }, { data: reads }] = await Promise.all([
    q,
    supabase.from("squad_messages").select("user_id, created_at").eq("challenge_id", ctx.challenge.id).eq("recipient_id", ctx.userId).order("created_at", { ascending: false }).limit(100),
    supabase.from("direct_reads").select("peer_id, last_read_at").eq("user_id", ctx.userId),
  ]);
  const readAt = new Map(((reads ?? []) as { peer_id: string; last_read_at: string }[]).map((r) => [r.peer_id, r.last_read_at]));
  const directCount = ((toMe ?? []) as { user_id: string; created_at: string }[]).filter((m) => !readAt.has(m.user_id) || m.created_at > readAt.get(m.user_id)!).length;
  const count = (groupCount ?? 0) + directCount;
  if (!count) return null;
  return <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-sage ring-2 ring-[#6a3b2f]" aria-label={`${count} nieuwe berichten`} />;
}
