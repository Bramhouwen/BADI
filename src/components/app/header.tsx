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
      {phase === "during" ? (
        <span className="flex h-11 items-center whitespace-nowrap rounded-full border border-ink/10 bg-white/70 px-3.5 text-[12px] font-semibold tabular-nums text-text shadow-sm backdrop-blur">
          Dag {day}
          <span className="ml-0.5 text-muted">/{total}</span>
        </span>
      ) : null}
      <Link
        href="/notifications"
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-white/70 text-text shadow-sm backdrop-blur hover:bg-white"
        aria-label={unread > 0 ? `${unread} nieuwe meldingen` : "Meldingen"}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-white" aria-hidden /> : null}
      </Link>
      <Link href="/profile" aria-label="Profiel" className="rounded-full ring-2 ring-white">
        <Avatar name={ctx.profile.display_name} src={avatar} size="md" className="h-11 w-11" />
      </Link>
    </div>
  );
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30" style={{ paddingTop: "var(--sat)" }}>
      <div className="mx-auto flex h-[68px] max-w-lg items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3" aria-label="BADI home">
          <Image src="/brand/wordmark-dark.png" alt="BADI" width={96} height={21} priority className="h-[20px] w-auto" />
          {isDemo() ? (
            <span className="rounded-full bg-gold/40 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-ink" title="Demo-modus: voorbeelddata, geen Supabase">
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
