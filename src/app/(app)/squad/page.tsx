import { Suspense } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { getSquad, requireContext, rotateMembers } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrlMap } from "@/lib/storage";
import { challengeDay, todayKey } from "@/lib/dates";
import { computeStreakStats } from "@/lib/streaks";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/ui/card";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { SquadMemberCard, type SquadCardMember } from "./squad-member-card";
import { SquadTimeline, type TimelineItem } from "./squad-timeline";
import { firstName } from "@/lib/utils";
import type { Compliment, DailyCheckin, Recipe, WallPost } from "@/lib/types";

export const metadata = { title: "Squad" };

async function Content() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const now = new Date();
  const today = todayKey(now, ctx.challenge.timezone);
  const day = challengeDay(ctx.challenge, now);

  const [squad, { data: checkinRows }, { data: recipeRows }, { data: postRows }, { data: complimentRows }, { count: unreadCount }] = await Promise.all([
    getSquad(ctx.challenge.id),
    supabase.from("daily_checkins").select("user_id, checkin_date, activities, created_at, updated_at").eq("challenge_id", ctx.challenge.id),
    supabase.from("recipes").select("id, user_id, title, created_at").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("wall_posts").select("id, user_id, created_at").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("compliments").select("id, sender_id, receiver_id, created_at, message").eq("receiver_id", ctx.userId).order("created_at", { ascending: false }).limit(10),
    supabase.from("compliments").select("id", { count: "exact", head: true }).eq("receiver_id", ctx.userId).is("read_at", null),
  ]);

  const checkins = (checkinRows ?? []) as Pick<DailyCheckin, "user_id" | "checkin_date" | "activities" | "created_at" | "updated_at">[];
  const recipes = (recipeRows ?? []) as Pick<Recipe, "id" | "user_id" | "title" | "created_at">[];
  const posts = (postRows ?? []) as Pick<WallPost, "id" | "user_id" | "created_at">[];
  const compliments = (complimentRows ?? []) as Pick<Compliment, "id" | "sender_id" | "receiver_id" | "created_at" | "message">[];
  const avatars = await signedUrlMap("avatars", squad.map((m) => m.profile.avatar_path).filter((p): p is string => Boolean(p)));
  const nameOf = (id: string) => firstName(squad.find((m) => m.user_id === id)?.profile.display_name ?? "Iemand");

  const members: SquadCardMember[] = rotateMembers(squad, day).map((m) => {
    const theirs = checkins.filter((c) => c.user_id === m.user_id);
    const stats = computeStreakStats(theirs.map((c) => c.checkin_date), today);
    const latestCheckin = [...theirs].sort((a, b) => (a.checkin_date < b.checkin_date ? 1 : -1))[0] ?? null;
    const latestRecipe = recipes.find((r) => r.user_id === m.user_id) ?? null;
    const latestPost = posts.find((p) => p.user_id === m.user_id) ?? null;
    const candidates = [
      latestCheckin ? { at: latestCheckin.updated_at, label: `Check-in: ${latestCheckin.activities.length} ${latestCheckin.activities.length === 1 ? "activiteit" : "activiteiten"}` } : null,
      latestRecipe ? { at: latestRecipe.created_at, label: `Recept: ${latestRecipe.title}` } : null,
      latestPost ? { at: latestPost.created_at, label: "Foto op de Wall" } : null,
    ].filter((c): c is { at: string; label: string } => Boolean(c));
    const latest = candidates.sort((a, b) => (a.at < b.at ? 1 : -1))[0] ?? null;
    return {
      id: m.user_id,
      name: m.profile.display_name,
      avatar: m.profile.avatar_path ? avatars.get(m.profile.avatar_path) ?? null : null,
      streak: stats.current,
      total: stats.total,
      checkedInToday: stats.checkedInToday,
      latestActivity: latest?.label ?? null,
      latestAt: latest?.at ?? null,
      isMe: m.user_id === ctx.userId,
    };
  });

  const timeline: TimelineItem[] = [
    ...checkins
      .filter((c) => c.checkin_date === today)
      .map((c) => ({ at: c.created_at, text: `${c.user_id === ctx.userId ? "Je hebt" : nameOf(c.user_id) + " heeft"} vandaag ingecheckt.`, emoji: "❄️" })),
    ...recipes.map((r) => ({ at: r.created_at, text: `${r.user_id === ctx.userId ? "Je hebt" : nameOf(r.user_id) + " heeft"} een nieuw recept gedeeld: ${r.title}.`, emoji: "🥑", href: `/kitchen/${r.id}` })),
    ...posts.map((p) => ({ at: p.created_at, text: `${p.user_id === ctx.userId ? "Je hebt" : nameOf(p.user_id) + " heeft"} een foto geplaatst.`, emoji: "📸", href: `/wall/${p.id}` })),
    ...compliments.map((c) => ({ at: c.created_at, text: `Je hebt een compliment ontvangen van ${nameOf(c.sender_id)}.`, emoji: "💌", href: "/squad/compliments" })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 12);

  return (
    <Page className="space-y-6">
      <RealtimeRefresher channel={`squad:${ctx.challenge.id}`} tables={["daily_checkins", "compliments", "wall_posts", "recipes"]} />
      <PageTitle
        title="The Squad 👥"
        subtitle="We doen dit samen. Geen ranking, wel elkaar."
        action={
          <Link href="/squad/compliments" className="relative flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-white/70 text-text backdrop-blur hover:bg-white" aria-label="Ontvangen complimenten">
            <Inbox className="h-5 w-5" />
            {(unreadCount ?? 0) > 0 ? <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-water-deep" aria-hidden /> : null}
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        {members.map((m) => (
          <SquadMemberCard key={m.id} member={m} />
        ))}
      </div>

      {squad.length < 4 ? (
        <p className="rounded-full border border-dashed border-ink/20 px-4 py-3 text-center text-sm text-muted">
          Nog {4 - squad.length} {4 - squad.length === 1 ? "plek" : "plekken"} vrij.{" "}
          {ctx.membership.role === "admin" ? (
            <Link href="/profile/invite" className="font-medium text-water-deep">
              Nodig een vriend uit
            </Link>
          ) : (
            "De beheerder kan uitnodigen."
          )}
        </p>
      ) : null}

      <section>
        <SectionTitle>Recent in de squad</SectionTitle>
        <SquadTimeline items={timeline} />
      </section>
    </Page>
  );
}

export default function SquadPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
