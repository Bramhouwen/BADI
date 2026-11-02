import { Suspense } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, Link2, LogOut, Sparkles } from "lucide-react";
import { loadSharing } from "@/lib/squad/data";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { formatDateNl, wrappedStatus } from "@/lib/dates";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { ProfileForm } from "./profile-form";
import { AlcoholExceptions } from "./alcohol-exceptions";
import { SharingSettings } from "./sharing-settings";
import { BaddyMemory } from "./baddy-memory";
import type { AlcoholException } from "@/lib/types";

export const metadata = { title: "Profiel" };

function Row({ href, icon: Icon, title, body }: { href: string; icon: typeof BookOpen; title: string; body: string }) {
  return (
    <Link href={href} className="glass flex items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-4 hover:bg-blush/40">
      <IconBadge icon={Icon} size="md" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-text">{title}</span>
        <span className="block truncate text-xs text-muted">{body}</span>
      </span>
      <ChevronRight className="h-[18px] w-[18px] text-muted" strokeWidth={1.6} />
    </Link>
  );
}

async function Content() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const [avatar, { data: exceptionRows }, sharing, { data: memoryRows }] = await Promise.all([
    signedUrl("avatars", ctx.profile.avatar_path),
    supabase.from("alcohol_exceptions").select("*").eq("user_id", ctx.userId).eq("challenge_id", ctx.challenge.id).order("exception_date"),
    loadSharing(ctx.userId),
    supabase.from("coach_memories").select("id, content, source").eq("user_id", ctx.userId).order("created_at", { ascending: true }),
  ]);
  const exceptions = (exceptionRows ?? []) as AlcoholException[];
  const wrapped = wrappedStatus(ctx.challenge);

  return (
    <Page className="space-y-6">
      <PageTitle title="Profiel" subtitle={ctx.email ?? undefined} back="/" />

      <ProfileForm displayName={ctx.profile.display_name} avatarUrl={avatar} avatarPath={ctx.profile.avatar_path} userId={ctx.userId} />

      <section>
        <SectionTitle>BADI</SectionTitle>
        <div className="space-y-2.5">
          <Row href="/profile/principles" icon={BookOpen} title="De zeven principes" body="Waar deze winter om draait." />
          {ctx.membership.role === "admin" ? <Row href="/profile/invite" icon={Link2} title="Squad uitnodigen" body="Maak uitnodigingslinks voor je vrienden." /> : null}
          <Row
            href="/wrapped"
            icon={Sparkles}
            title="Winter Arc Wrapped"
            body={wrapped === "final" ? "Jullie definitieve terugblik." : wrapped === "preliminary" ? "Voorlopige terugblik tijdens de finale." : `Beschikbaar vanaf ${formatDateNl(ctx.challenge.end_date, { day: "numeric", month: "long" })}.`}
          />
        </div>
      </section>

      <section id="baddy-geheugen">
        <SectionTitle action={<Link href="/coach" className="text-[13px] text-muted">Naar Baddy</Link>}>Wat Baddy over mij weet</SectionTitle>
        <p className="mb-2.5 px-0.5 text-[12.5px] leading-snug text-muted">Alleen jij en Baddy zien dit. Baddy houdt er bij elk advies rekening mee.</p>
        <BaddyMemory initial={(memoryRows ?? []) as { id: string; content: string; source: "coach" | "member" }[]} />
      </section>

      <section id="zichtbaarheid">
        <SectionTitle action={<Link href={`/squad/${ctx.userId}`} className="text-[13px] text-muted">Mijn profiel</Link>}>Mijn Squad zichtbaarheid</SectionTitle>
        <p className="mb-2.5 px-0.5 text-[12.5px] leading-snug text-muted">Squadleden zien alleen wat je hier aanzet. Uitzetten werkt direct.</p>
        <SharingSettings initial={sharing} />
      </section>

      <section>
        <SectionTitle>Alcoholbewust (privé)</SectionTitle>
        <AlcoholExceptions exceptions={exceptions} min={ctx.challenge.start_date} max={ctx.challenge.end_date} />
      </section>

      <form action="/auth/signout" method="post">
        <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-full border border-ink/10 bg-white py-3 text-sm font-medium text-ink hover:bg-blush">
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
