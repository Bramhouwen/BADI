import { Suspense } from "react";
import { getSquad, requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrlMap } from "@/lib/storage";
import { addDays, daysUntilFinale, formatDateNl, todayKey, wrappedStatus } from "@/lib/dates";
import { computeWrapped } from "@/lib/wrapped";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WrappedView } from "./wrapped-view";
import type { Compliment, DailyCheckin, Recipe, WallPost } from "@/lib/types";
import { isDemo } from "@/lib/demo";

export const metadata = { title: "Wrapped" };

async function Content({ searchParams }: { searchParams: Promise<{ preview?: string | string[] }> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const now = new Date();
  // Demo mode only: /wrapped?preview=1 shows the Wrapped layout before the finale.
  const status = isDemo() && sp.preview === "1" ? "preliminary" : wrappedStatus(ctx.challenge, now);

  if (status === "not_yet") {
    const d = daysUntilFinale(ctx.challenge, now);
    return (
      <Page>
        <PageTitle title="Winter Arc Wrapped ✨" back="/profile" />
        <EmptyState
          emoji="🎁"
          title={`Nog ${d} ${d === 1 ? "dag" : "dagen"} tot de finale`}
          body={`Op ${formatDateNl(ctx.challenge.end_date)} verschijnt hier jullie voorlopige Wrapped. De definitieve versie volgt zodra de laatste check-in is afgerond.`}
          action={
            isDemo() ? (
              <Link href="/wrapped?preview=1">
                <Button variant="secondary">Demo: bekijk de Wrapped alvast</Button>
              </Link>
            ) : undefined
          }
        />
      </Page>
    );
  }

  const supabase = await createClient();
  const [squad, { data: checkinRows }, { data: postRows }, { data: recipeRows }, { data: complimentRows }] = await Promise.all([
    getSquad(ctx.challenge.id),
    supabase.from("daily_checkins").select("user_id, checkin_date, activities").eq("challenge_id", ctx.challenge.id),
    supabase.from("wall_posts").select("id, user_id, image_path, caption, created_at").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }),
    supabase.from("recipes").select("user_id").eq("challenge_id", ctx.challenge.id),
    supabase.from("compliments").select("sender_id, receiver_id").eq("challenge_id", ctx.challenge.id),
  ]);
  // Compliments are only readable by sender and receiver. The group total comes
  // from a SECURITY DEFINER function that never exposes who received what.
  const { data: groupComplimentCount } = await supabase.rpc("group_compliment_count");

  const posts = (postRows ?? []) as Pick<WallPost, "id" | "user_id" | "image_path" | "caption" | "created_at">[];
  const checkins = (checkinRows ?? []) as Pick<DailyCheckin, "user_id" | "checkin_date" | "activities">[];
  const result = computeWrapped({
    members: squad.map((m) => ({ id: m.user_id, display_name: m.profile.display_name, avatar_path: m.profile.avatar_path })),
    checkins,
    posts,
    recipes: (recipeRows ?? []) as Pick<Recipe, "user_id">[],
    compliments: (complimentRows ?? []) as Pick<Compliment, "sender_id" | "receiver_id">[],
    challenge: ctx.challenge,
    today: status === "final" ? addDays(ctx.challenge.end_date, 1) : todayKey(now, ctx.challenge.timezone),
  });
  result.group.totalCompliments = typeof groupComplimentCount === "number" ? groupComplimentCount : result.group.totalCompliments;

  const [memoryUrls, avatarUrls] = await Promise.all([
    signedUrlMap("wall", result.memories.map((m) => m.image_path)),
    signedUrlMap("avatars", squad.map((m) => m.profile.avatar_path).filter((p): p is string => Boolean(p))),
  ]);

  return (
    <WrappedView
      status={status}
      challengeName={ctx.challenge.name}
      meId={ctx.userId}
      group={result.group}
      personal={result.personal.map((p) => ({
        ...p,
        // Only your own compliment counts leave the server; nobody sees a ranking.
        complimentsReceived: p.member.id === ctx.userId ? p.complimentsReceived : 0,
        complimentsSent: p.member.id === ctx.userId ? p.complimentsSent : 0,
        avatarUrl: p.member.avatar_path ? avatarUrls.get(p.member.avatar_path) ?? null : null,
      }))}
      memories={result.memories.map((m) => ({ id: m.id, url: memoryUrls.get(m.image_path) ?? null, caption: m.caption }))}
    />
  );
}

export default function WrappedPage({ searchParams }: PageProps<"/wrapped">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
