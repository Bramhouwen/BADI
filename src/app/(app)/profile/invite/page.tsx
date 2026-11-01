import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSquad, requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Card, SectionTitle } from "@/components/ui/card";
import { InviteManager } from "./invite-manager";
import { MAX_MEMBERS } from "@/lib/constants";
import type { Invitation } from "@/lib/types";

export const metadata = { title: "Uitnodigen" };

async function Content() {
  const ctx = await requireContext();
  if (ctx.membership.role !== "admin") redirect("/profile");
  const supabase = await createClient();
  const [squad, { data: rows }] = await Promise.all([
    getSquad(ctx.challenge.id),
    supabase.from("invitations").select("*").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }),
  ]);
  const invitations = (rows ?? []) as Invitation[];
  const open = invitations.filter((i) => !i.accepted_at && new Date(i.expires_at) > new Date());
  const spots = MAX_MEMBERS - squad.length;

  return (
    <Page className="space-y-6">
      <PageTitle title="Squad uitnodigen" subtitle={`${squad.length} van ${MAX_MEMBERS} plekken bezet.`} back="/profile" />
      <section>
        <SectionTitle>Leden</SectionTitle>
        <Card className="divide-y divide-white/10 p-0">
          {squad.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-medium">{m.profile.display_name}</span>
              <span className="text-xs text-muted">{m.role === "admin" ? "Beheerder" : "Lid"}</span>
            </div>
          ))}
        </Card>
      </section>
      <InviteManager spots={spots} open={open.map((i) => ({ id: i.id, invited_email: i.invited_email, expires_at: i.expires_at }))} />
    </Page>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
