import { Suspense } from "react";
import Link from "next/link";
import { Camera, Inbox } from "lucide-react";
import { getSquad, requireContext, rotateMembers } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrlMap } from "@/lib/storage";
import { challengeDay, todayKey } from "@/lib/dates";
import { computeStreakStats } from "@/lib/streaks";
import { firstName } from "@/lib/utils";
import { BADDY_ID, CHAT_PAGE_SIZE, asSender, type ChatMessage } from "@/lib/chat";
import { mentionLabels } from "@/lib/mentions";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { weekScore, weekStartOf } from "@/lib/checkin-plan";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { PushPrompt } from "@/components/app/push-prompt";
import { SquadChat, type ChatMember } from "./squad-chat";
import type { PostOption, RecipeOption } from "./chat-attach";
import { cn } from "@/lib/utils";

export const metadata = { title: "Squad" };

async function Content() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const now = new Date();
  const today = todayKey(now, ctx.challenge.timezone);
  const day = challengeDay(ctx.challenge, now);

  const weekStart = weekStartOf(today);
  const [squad, { data: checkinRows }, { data: messageRows }, { count: unreadCount }, { data: recipeRows }, { data: postRows }, { data: jokerRows }] = await Promise.all([
    getSquad(ctx.challenge.id),
    supabase.from("daily_checkins").select("user_id, checkin_date, activities").eq("challenge_id", ctx.challenge.id),
    supabase
      .from("squad_messages")
      .select("id, user_id, body, created_at, attachment_type, attachment_path, attachment_name, ref_id, is_coach")
      .eq("challenge_id", ctx.challenge.id)
      .order("created_at", { ascending: false })
      .limit(CHAT_PAGE_SIZE),
    supabase.from("compliments").select("id", { count: "exact", head: true }).eq("receiver_id", ctx.userId).is("read_at", null),
    supabase.from("recipes").select("id, title, image_path").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }).limit(40),
    supabase.from("wall_posts").select("id, image_path, caption").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }).limit(40),
    supabase.from("alcohol_exceptions").select("user_id, exception_date").eq("challenge_id", ctx.challenge.id).gte("exception_date", weekStart),
  ]);

  const checkins = (checkinRows ?? []) as { user_id: string; checkin_date: string; activities: string[] }[];
  const jokers = (jokerRows ?? []) as { user_id: string; exception_date: string }[];
  const newestFirst = (messageRows ?? []) as ChatMessage[];
  const messages = [...newestFirst].reverse().map(asSender);
  const recipeRaw = (recipeRows ?? []) as { id: string; title: string; image_path: string | null }[];
  const postRaw = (postRows ?? []) as { id: string; image_path: string; caption: string | null }[];
  const attachmentPaths = messages.map((m) => m.attachment_path).filter((p): p is string => Boolean(p));
  const [avatars, recipeImages, postImages, chatSigned] = await Promise.all([
    signedUrlMap("avatars", squad.map((m) => m.profile.avatar_path).filter((p): p is string => Boolean(p))),
    signedUrlMap("recipes", recipeRaw.map((r) => r.image_path).filter((p): p is string => Boolean(p))),
    signedUrlMap("wall", postRaw.map((p) => p.image_path)),
    signedUrlMap("chat", attachmentPaths),
  ]);
  const recipes: RecipeOption[] = recipeRaw.map((r) => ({ id: r.id, title: r.title, image: r.image_path ? recipeImages.get(r.image_path) ?? null : null }));
  const posts: PostOption[] = postRaw.map((p) => ({ id: p.id, image: postImages.get(p.image_path) ?? null, caption: p.caption }));
  const signed = Object.fromEntries(chatSigned);
  const mentionMembers = [...mentionLabels(squad.map((m) => ({ id: m.user_id, display_name: m.profile.display_name }))), { id: BADDY_ID, label: "Baddy" }];

  const members = rotateMembers(squad, day).map((m) => {
    const stats = computeStreakStats(checkins.filter((c) => c.user_id === m.user_id).map((c) => c.checkin_date), today);
    return {
      id: m.user_id,
      name: m.profile.display_name,
      avatar: m.profile.avatar_path ? avatars.get(m.profile.avatar_path) ?? null : null,
      streak: stats.current,
      checkedInToday: stats.checkedInToday,
      isMe: m.user_id === ctx.userId,
      week: weekScore(
        weekStart,
        checkins.filter((c) => c.user_id === m.user_id && c.checkin_date >= weekStart),
        jokers.filter((j) => j.user_id === m.user_id).map((j) => j.exception_date),
      ),
    };
  });
  const chatMembers: Record<string, ChatMember> = {
    ...Object.fromEntries(members.map((m) => [m.id, { name: firstName(m.name), avatar: m.avatar }])),
    [BADDY_ID]: { name: "Baddy", avatar: "/brand/baddy.jpg" },
  };

  return (
    <Page className="space-y-5">
      <RealtimeRefresher channel={`squad:${ctx.challenge.id}`} tables={["daily_checkins", "compliments"]} />
      <PageTitle
        title="The Squad"
        action={
          <div className="flex items-center gap-2">
            <Link href="/coach" className="flex h-10 items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-3 text-[12.5px] font-medium text-ink shadow-sm hover:bg-blush" aria-label="Baddy de Coach">
              <Avatar name="Baddy" src="/brand/baddy.jpg" size="xs" className="h-8 w-8" />
              Baddy
            </Link>
            <Link href="/wall" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm hover:bg-blush" aria-label="The Wall">
              <Camera className="h-[18px] w-[18px]" strokeWidth={1.6} />
            </Link>
            <Link href="/squad/compliments" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm hover:bg-blush" aria-label="Ontvangen complimenten">
              <Inbox className="h-[18px] w-[18px]" strokeWidth={1.6} />
              {(unreadCount ?? 0) > 0 ? <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-sage ring-2 ring-white" aria-hidden /> : null}
            </Link>
          </div>
        }
      />

      <section aria-label="Leden" className="sticky top-[calc(var(--sat)+60px)] z-20 rounded-[22px] bg-[#fbf7f2] px-3 py-3 shadow-[0_12px_28px_-20px_rgba(95,53,41,0.45)] ring-1 ring-ink/[0.05]">
        <ul className="grid grid-cols-4 gap-1">
          {members.map((m) => (
            <li key={m.id}>
              <Link href={`/squad/${m.id}`} className="flex flex-col items-center gap-1.5 rounded-[16px] py-1 hover:bg-blush/40" aria-label={`Profiel van ${firstName(m.name)}`}>
                <MemberAvatar userId={m.id} name={m.name} src={m.avatar} size={56} progress={m.week.fraction} />
                <span className="max-w-full truncate text-[12.5px] font-medium text-text">
                  {firstName(m.name)}
                  {m.isMe ? <span className="text-muted"> (jij)</span> : null}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-medium tabular-nums", m.streak > 0 ? "bg-sage/20 text-ink" : "bg-blush text-muted")}>
                  {m.streak} {m.streak === 1 ? "dag" : "dagen"}
                </span>
              </Link>
            </li>
          ))}
          {squad.length < 4
            ? Array.from({ length: 4 - squad.length }).map((_, i) => (
                <li key={`free-${i}`}>
                  {ctx.membership.role === "admin" ? (
                    <Link href="/profile/invite" className="flex flex-col items-center gap-1.5 rounded-[16px] py-1 hover:bg-blush/40" aria-label="Nodig een vriend uit">
                      <span className="flex h-[66px] w-[66px] items-center justify-center rounded-full border border-dashed border-ink/25 text-[20px] text-muted">+</span>
                      <span className="text-[12.5px] font-medium text-muted">Uitnodigen</span>
                    </Link>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 py-1">
                      <span className="h-[66px] w-[66px] rounded-full border border-dashed border-ink/20" />
                      <span className="text-[12.5px] text-muted">Vrij</span>
                    </div>
                  )}
                </li>
              ))
            : null}
        </ul>
      </section>

      <PushPrompt publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />

      <SquadChat
        initial={messages}
        hasMore={newestFirst.length === CHAT_PAGE_SIZE}
        members={chatMembers}
        me={ctx.userId}
        challengeId={ctx.challenge.id}
        today={today}
        tz={ctx.challenge.timezone}
        recipes={recipes}
        posts={posts}
        signed={signed}
        mentionMembers={mentionMembers}
      />
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
