import { Suspense } from "react";
import Link from "next/link";
import { getSquad, requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrlMap } from "@/lib/storage";
import { relativeTimeNl } from "@/lib/dates";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { MarkNotificationsRead } from "./mark-read";
import { firstName, cn } from "@/lib/utils";
import { Bell } from "lucide-react";
import type { AppNotification } from "@/lib/types";

export const metadata = { title: "Meldingen" };

function describe(n: AppNotification, actor: string): { text: string; emoji: string; href: string } {
  switch (n.type) {
    case "compliment":
      return { text: `${actor} stuurde je een compliment.`, emoji: "💌", href: "/squad/compliments" };
    case "reaction":
      return { text: `${actor} reageerde op je foto.`, emoji: "🔥", href: n.ref_id ? `/wall/${n.ref_id}` : "/wall" };
    case "post":
      return { text: `${actor} plaatste een nieuwe foto op de Wall.`, emoji: "📸", href: n.ref_id ? `/wall/${n.ref_id}` : "/wall" };
    case "recipe":
      return { text: `${actor} deelde een nieuw recept.`, emoji: "🥑", href: n.ref_id ? `/kitchen/${n.ref_id}` : "/kitchen" };
    case "mention":
      return { text: `${actor} noemde je in de squadchat.`, emoji: "💬", href: "/squad" };
    case "joker":
      return { text: `${actor} zet een joker in.`, emoji: "🃏", href: "/squad" };
  }
}

async function Content() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const [squad, { data: rows }] = await Promise.all([
    getSquad(ctx.challenge.id),
    supabase.from("notifications").select("*").eq("user_id", ctx.userId).order("created_at", { ascending: false }).limit(100),
  ]);
  const notifications = (rows ?? []) as AppNotification[];
  const avatars = await signedUrlMap("avatars", squad.map((m) => m.profile.avatar_path).filter((p): p is string => Boolean(p)));
  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <Page>
      {hasUnread ? <MarkNotificationsRead /> : null}
      <PageTitle title="Meldingen" subtitle="Meldingen van je squad." back="/" />
      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="Nog geen meldingen" body="Complimenten, reacties op je foto's en nieuwe posts van je squad komen hier binnen." />
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const actorProfile = squad.find((m) => m.user_id === n.actor_id)?.profile;
            const actor = firstName(actorProfile?.display_name ?? "Iemand");
            const d = describe(n, actor);
            return (
              <li key={n.id}>
                <Link href={d.href} className={cn("glass flex items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-4 hover:bg-blush/40", !n.read_at && "ring-1 ring-sage")}>
                  <Avatar name={actorProfile?.display_name ?? "?"} src={actorProfile?.avatar_path ? avatars.get(actorProfile.avatar_path) ?? null : null} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug">{d.text}</span>
                    <span className="block text-xs text-muted">{relativeTimeNl(n.created_at)}</span>
                  </span>
                  {!n.read_at ? <span className="h-2 w-2 shrink-0 rounded-full bg-sage" aria-label="Nieuw" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
