import Link from "next/link";
import { Suspense } from "react";
import { Bell } from "lucide-react";
import { getContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { challengeDay, challengeLengthDays, challengePhase } from "@/lib/dates";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

async function HeaderStatus() {
  const ctx = await getContext();
  if (!ctx) return null;
  const supabase = await createClient();
  const [{ count }, avatar] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .is("read_at", null),
    signedUrl("avatars", ctx.profile.avatar_path),
  ]);
  const phase = challengePhase(ctx.challenge);
  const day = challengeDay(ctx.challenge);
  const total = challengeLengthDays(ctx.challenge);
  const unread = count ?? 0;

  return (
    <div className="flex items-center gap-2">
      {phase === "during" ? (
        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted">
          Dag {day}/{total}
        </span>
      ) : null}
      <Link
        href="/notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-card hover:text-text"
        aria-label={unread > 0 ? `${unread} nieuwe meldingen` : "Meldingen"}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ice px-1 text-[10px] font-bold text-bg">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Link>
      <Link href="/profile" aria-label="Profiel" className="rounded-full">
        <Avatar name={ctx.profile.display_name} src={avatar} size="sm" />
      </Link>
    </div>
  );
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/80 backdrop-blur-xl" style={{ paddingTop: "var(--sat)" }}>
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <Link href="/" className="flex flex-col leading-none">
          <span className="text-[15px] font-extrabold tracking-[0.08em]">
            WINTER ARC <span aria-hidden>❄️</span>
          </span>
          <span className="mt-0.5 text-[10px] font-semibold tracking-[0.22em] text-ice">BETTER TOGETHER</span>
        </Link>
        <Suspense fallback={<Skeleton className="h-9 w-24 rounded-full" />}>
          <HeaderStatus />
        </Suspense>
      </div>
    </header>
  );
}
