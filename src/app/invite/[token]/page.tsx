import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/data";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/errors";
import { AcceptInviteButton } from "./accept-button";

export const metadata = { title: "Uitnodiging" };

async function Content({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data: preview }, { data: auth }] = await Promise.all([
    supabase.rpc("preview_invitation", { p_token: token }).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const user = auth.user;
  const info = preview as { challenge_name: string | null; inviter_name: string | null; valid: boolean; reason: string | null } | null;
  const ctx = user ? await getContext() : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-5 text-center" style={{ paddingTop: "var(--sat)" }}>
      <Image src="/brand/logo-full.png" alt="BADI" width={200} height={172} priority className="mb-6 h-auto w-[180px]" />
      {!info || !info.challenge_name ? (
        <>
          <h1 className="text-2xl font-bold">Deze uitnodiging bestaat niet</h1>
          <p className="mt-2 text-sm text-muted">Vraag de beheerder om een nieuwe link.</p>
        </>
      ) : !info.valid ? (
        <>
          <h1 className="text-2xl font-bold">Deze link werkt niet meer</h1>
          <p className="mt-2 text-sm text-muted">{friendlyError(info.reason ?? "INVITE_INVALID")}</p>
        </>
      ) : ctx ? (
        <>
          <h1 className="text-2xl font-bold">Je zit al in een squad</h1>
          <p className="mt-2 text-sm text-muted">Je bent al lid van {ctx.challenge.name}. Eén Winter Arc per persoon.</p>
          <Link href="/" className="mt-6">
            <Button>Naar de app</Button>
          </Link>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold tracking-[0.2em] text-ice">UITNODIGING</p>
          <h1 className="mt-2 text-2xl font-bold">{info.inviter_name} nodigt je uit voor {info.challenge_name}</h1>
          <p className="mt-2 text-sm text-muted">
            Vier vrienden, één winter. Show up for yourself, inspire the others, grow together.
          </p>
          {user ? (
            <AcceptInviteButton token={token} />
          ) : (
            <div className="mt-6 flex w-full flex-col gap-2">
              <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>
                <Button size="lg" className="w-full">
                  Log in of maak een account
                </Button>
              </Link>
              <p className="text-xs text-muted">Na het inloggen kom je hier terug om de uitnodiging te accepteren.</p>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
