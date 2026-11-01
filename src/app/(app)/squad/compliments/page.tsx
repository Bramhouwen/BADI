import { Suspense } from "react";
import { getSquad, requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrlMap } from "@/lib/storage";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { relativeTimeNl } from "@/lib/dates";
import { MarkRead } from "./mark-read";
import type { Compliment } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Complimenten" };

async function Content() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const [squad, { data: rows }] = await Promise.all([
    getSquad(ctx.challenge.id),
    supabase.from("compliments").select("*").eq("receiver_id", ctx.userId).order("created_at", { ascending: false }).limit(200),
  ]);
  const compliments = (rows ?? []) as Compliment[];
  const avatars = await signedUrlMap("avatars", squad.map((m) => m.profile.avatar_path).filter((p): p is string => Boolean(p)));
  const hasUnread = compliments.some((c) => !c.read_at);

  return (
    <Page>
      {hasUnread ? <MarkRead /> : null}
      <PageTitle title="Ontvangen complimenten" subtitle="Lieve woorden van je squad, om nog eens terug te lezen." back="/squad" />
      {compliments.length === 0 ? (
        <EmptyState emoji="💌" title="Nog geen complimenten" body="Geef er zelf eentje weg. Dat komt bijna altijd terug." />
      ) : (
        <ul className="space-y-2">
          {compliments.map((c) => {
            const sender = squad.find((m) => m.user_id === c.sender_id)?.profile;
            return (
              <li key={c.id} className={cn("glass flex items-start gap-3 rounded-[24px] px-3.5 py-3", !c.read_at && "border-water-deep")}>
                <Avatar name={sender?.display_name ?? "Lid"} src={sender?.avatar_path ? avatars.get(sender.avatar_path) ?? null : null} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-snug">{c.message}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {sender?.display_name ?? "Lid"} · {relativeTimeNl(c.created_at)}
                  </p>
                </div>
                {!c.read_at ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-water-deep" aria-label="Nieuw" /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}

export default function ComplimentsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
