import { Suspense } from "react";
import Link from "next/link";
import { Camera, Crown, Inbox } from "lucide-react";
import { getSquad, requireContext, rotateMembers } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { challengeDay, todayKey } from "@/lib/dates";
import { computeStreakStats } from "@/lib/streaks";
import { SUPER_BADI_RULE, superBadi } from "@/lib/super-badi";
import { firstName } from "@/lib/utils";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { weekScore, weekStartOf } from "@/lib/checkin-plan";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { PushPrompt } from "@/components/app/push-prompt";
import { loadChatList, loadPeople } from "@/lib/chat-data";
import { ChatList } from "./chat-list";
import { cn } from "@/lib/utils";

export const metadata = { title: "Squad" };

async function Content() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const now = new Date();
  const today = todayKey(now, ctx.challenge.timezone);
  const day = challengeDay(ctx.challenge, now);

  const weekStart = weekStartOf(today);
  const [squad, people, { data: checkinRows }, { count: unreadCount }, { data: jokerRows }, { data: stepRows }] = await Promise.all([
    getSquad(ctx.challenge.id),
    loadPeople(ctx),
    supabase.from("daily_checkins").select("user_id, checkin_date, activities").eq("challenge_id", ctx.challenge.id),
    supabase.from("compliments").select("id", { count: "exact", head: true }).eq("receiver_id", ctx.userId).is("read_at", null),
    supabase.from("alcohol_exceptions").select("user_id, exception_date").eq("challenge_id", ctx.challenge.id).gte("exception_date", weekStart),
    supabase.from("step_logs").select("user_id, log_date, steps").eq("challenge_id", ctx.challenge.id).gte("log_date", weekStart),
  ]);
  const steps = (stepRows ?? []) as { user_id: string; log_date: string; steps: number }[];
  const chats = await loadChatList(ctx, people);

  const checkins = (checkinRows ?? []) as { user_id: string; checkin_date: string; activities: string[] }[];
  const jokers = (jokerRows ?? []) as { user_id: string; exception_date: string }[];
  const avatarOf = (id: string) => people.find((p) => p.id === id)?.avatar ?? null;

  const members = rotateMembers(squad, day).map((m) => {
    const stats = computeStreakStats(checkins.filter((c) => c.user_id === m.user_id).map((c) => c.checkin_date), today);
    return {
      id: m.user_id,
      name: m.profile.display_name,
      avatar: avatarOf(m.user_id),
      streak: stats.current,
      checkedInToday: stats.checkedInToday,
      isMe: m.user_id === ctx.userId,
      week: weekScore(
        weekStart,
        checkins.filter((c) => c.user_id === m.user_id && c.checkin_date >= weekStart),
        jokers.filter((j) => j.user_id === m.user_id).map((j) => j.exception_date),
        steps.filter((s) => s.user_id === m.user_id),
      ),
    };
  });

  const crowned = superBadi(
    members.map((m) => ({ id: m.id, streak: m.streak, weekPoints: m.week.earned, totalDays: computeStreakStats(checkins.filter((c) => c.user_id === m.id).map((c) => c.checkin_date), today).total })),
  );

  return (
    <Page className="space-y-5">
      <RealtimeRefresher channel={`squad:${ctx.challenge.id}`} tables={["daily_checkins", "compliments", "squad_messages", "direct_reads"]} />
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
        <ul className="grid grid-cols-4 gap-1 pt-2">
          {members.map((m) => (
            <li key={m.id}>
              <Link href={`/squad/${m.id}`} className="flex flex-col items-center gap-1.5 rounded-[16px] py-1 hover:bg-blush/40" aria-label={`Profiel van ${firstName(m.name)}`}>
                <MemberAvatar userId={m.id} name={m.name} src={m.avatar} size={56} progress={m.week.fraction} crown={crowned.has(m.id)} />
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

      {crowned.size > 0 ? (
        <p className="-mt-2 flex items-start gap-1.5 px-1 text-[11.5px] leading-snug text-muted">
          <Crown className="mt-[1px] h-3.5 w-3.5 shrink-0 text-[#c9962e]" strokeWidth={1.8} />
          <span>
            <span className="font-medium text-ink">Super Badi</span>: {SUPER_BADI_RULE}
          </span>
        </p>
      ) : null}

      <PushPrompt publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />

      <section aria-label="Chats">
        <h2 className="mb-1.5 px-0.5 font-display text-[22px]">Chats</h2>
        <ChatList items={chats} people={people} me={ctx.userId} today={today} tz={ctx.challenge.timezone} />
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
