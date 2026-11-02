import { Suspense } from "react";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { isDemo } from "@/lib/demo";
import { hasCoachKey } from "@/lib/coach/run";
import { parseRefs } from "@/lib/coach/prompt";
import { PageSkeleton } from "@/components/ui/skeleton";
import { CoachChat, type CoachMessage } from "./coach-chat";

export const metadata = { title: "Baddy" };

async function Content({ searchParams }: { searchParams: Promise<{ q?: string | string[]; send?: string | string[] }> }) {
  const [ctx, sp] = await Promise.all([requireContext(), searchParams]);
  const supabase = await createClient();
  const { data } = await supabase.from("coach_messages").select("id, role, body, refs, created_at, feedback").eq("user_id", ctx.userId).order("created_at", { ascending: false }).limit(60);
  const messages: CoachMessage[] = ((data ?? []) as { id: string; role: "user" | "assistant"; body: string; refs: unknown; created_at: string; feedback: number | null }[])
    .reverse()
    .map((m) => ({ id: m.id, role: m.role, body: m.body, refs: parseRefs(m.refs), created_at: m.created_at, feedback: m.feedback === 1 || m.feedback === -1 ? m.feedback : null }));
  const prefill = typeof sp.q === "string" ? sp.q.slice(0, 400) : "";
  return <CoachChat initial={messages} prefill={prefill} autoSend={sp.send === "1" && prefill.length > 0} available={isDemo() || hasCoachKey()} />;
}

export default function CoachPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; send?: string | string[] }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
