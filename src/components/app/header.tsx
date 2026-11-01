import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { Bell } from "lucide-react";
import { getContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { challengeDay, challengeLengthDays, challengePhase } from "@/lib/dates";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { isDemo } from "@/lib/demo";

async function HeaderStatus() {
  const ctx = await getContext();
  if (!ctx) return null;
  const supabase = await createClient();
  const [{ count }, avatar] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).is("read_at", null),
    signedUrl("avatars", ctx.profile.avatar_path),
  ]);
  const phase = challengePhase(ctx.challenge);
  const day = challengeDay(ctx.challenge);
  const total = challengeLengthDays(ctx.challenge);
  const unread = count ?? 0;

  return (
    <div className="flex items-center gap-2">
      {phase === "during" ? <span className="sr-only">Dag {day} van {total}</span> : null}
      <Link
        href="/notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm hover:bg-blush"
        aria-label={unread > 0 ? `${unread} nieuwe meldingen` : "Meldingen"}
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.6} />
        {unread > 0 ? <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-white" aria-hidden /> : null}
      </Link>
      <Link href="/profile" aria-label="Profiel" className="rounded-full ring-2 ring-white">
        <Avatar name={ctx.profile.display_name} src={avatar} size="md" className="h-10 w-10" />
      </Link>
    </div>
  );
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30" style={{ paddingTop: "var(--sat)" }}>
      <div className="mx-auto flex h-[64px] max-w-lg items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-3" aria-label="BADI home">
          <Image src="/brand/runner-dark.png" alt="BADI, run squat" width={40} height={35} priority className="h-[30px] w-auto" />
          <Image src="/brand/wordmark-tagline-dark.png" alt="" width={96} height={33} priority className="h-[30px] w-auto" />
          {isDemo() ? (
            <span className="soft rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider" title="Demo-modus: voorbeelddata, geen Supabase">
              DEMO
            </span>
          ) : null}
        </Link>
        <Suspense fallback={<Skeleton className="h-11 w-28 rounded-full" />}>
          <HeaderStatus />
        </Suspense>
      </div>
    </header>
  );
}
