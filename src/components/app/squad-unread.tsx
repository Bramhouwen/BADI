import { getContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/** Small dot on the Squad tab while there are chat messages the user has not seen. */
export async function SquadUnreadDot() {
  const ctx = await getContext();
  if (!ctx) return null;
  const supabase = await createClient();
  const { data: read } = await supabase.from("squad_chat_reads").select("last_read_at").eq("challenge_id", ctx.challenge.id).eq("user_id", ctx.userId).maybeSingle();
  let q = supabase.from("squad_messages").select("id", { count: "exact", head: true }).eq("challenge_id", ctx.challenge.id).neq("user_id", ctx.userId);
  const lastRead = (read as { last_read_at?: string } | null)?.last_read_at;
  if (lastRead) q = q.gt("created_at", lastRead);
  const { count } = await q;
  if (!count) return null;
  return <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-sage ring-2 ring-[#6a3b2f]" aria-label={`${count} nieuwe berichten`} />;
}
