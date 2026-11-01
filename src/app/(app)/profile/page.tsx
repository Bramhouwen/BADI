import { Suspense } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, Link2, LogOut, Sparkles } from "lucide-react";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { formatDateNl, wrappedStatus } from "@/lib/dates";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Card, SectionTitle } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";
import { AlcoholExceptions } from "./alcohol-exceptions";
import type { AlcoholException } from "@/lib/types";

export const metadata = { title: "Profiel" };

function Row({ href, icon: Icon, title, body }: { href: string; icon: typeof BookOpen; title: string; body: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-card-2">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-2 text-ice">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted">{body}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-muted" />
    </Link>
  );
}

async function Content() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const [avatar, { data: exceptionRows }] = await Promise.all([
    signedUrl("avatars", ctx.profile.avatar_path),
    supabase.from("alcohol_exceptions").select("*").eq("user_id", ctx.userId).eq("challenge_id", ctx.challenge.id).order("exception_date"),
  ]);
  const exceptions = (exceptionRows ?? []) as AlcoholException[];
  const wrapped = wrappedStatus(ctx.challenge);

  return (
    <Page className="space-y-6">
      <PageTitle title="Profiel" subtitle={ctx.email ?? undefined} back="/" />

      <ProfileForm displayName={ctx.profile.display_name} avatarUrl={avatar} avatarPath={ctx.profile.avatar_path} userId={ctx.userId} />

      <section>
        <SectionTitle>Winter Arc</SectionTitle>
        <Card className="divide-y divide-border/60 p-0">
          <Row href="/profile/principles" icon={BookOpen} title="De zeven principes" body="Waar deze winter om draait." />
          {ctx.membership.role === "admin" ? <Row href="/profile/invite" icon={Link2} title="Squad uitnodigen" body="Maak uitnodigingslinks voor je vrienden." /> : null}
          <Row
            href="/wrapped"
            icon={Sparkles}
            title="Winter Arc Wrapped"
            body={wrapped === "final" ? "Jullie definitieve terugblik." : wrapped === "preliminary" ? "Voorlopige terugblik tijdens de finale." : `Beschikbaar vanaf ${formatDateNl(ctx.challenge.end_date, { day: "numeric", month: "long" })}.`}
          />
        </Card>
      </section>

      <section>
        <SectionTitle>Alcoholbewust (privé)</SectionTitle>
        <AlcoholExceptions exceptions={exceptions} min={ctx.challenge.start_date} max={ctx.challenge.end_date} />
      </section>

      <form action="/auth/signout" method="post">
        <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-medium text-muted hover:bg-card hover:text-text">
          <LogOut className="h-4 w-4" /> Uitloggen
        </button>
      </form>
      <p className="text-center text-[11px] text-muted">
        {ctx.challenge.name} · {formatDateNl(ctx.challenge.start_date, { day: "numeric", month: "short" })} t/m {formatDateNl(ctx.challenge.end_date, { day: "numeric", month: "short", year: "numeric" })}
      </p>
    </Page>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
