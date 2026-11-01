import { Suspense } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getContext, requireUser } from "@/lib/data";
import { PageSkeleton } from "@/components/ui/skeleton";
import { OnboardingForms } from "./onboarding-forms";
import { DEFAULT_CHALLENGE } from "@/lib/constants";
import { formatDateNl } from "@/lib/dates";

export const metadata = { title: "Welkom" };

async function Content() {
  await requireUser();
  const ctx = await getContext();
  if (ctx) redirect("/");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-5 pb-10" style={{ paddingTop: "calc(var(--sat) + 32px)" }}>
      <div className="mb-8 text-center">
        <Image src="/brand/logo-full-dark.png" alt="BADI" width={150} height={125} priority className="mx-auto mb-5 h-auto w-[130px]" />
        <h1 className="font-display text-[30px]">Welkom bij BADI</h1>
        <p className="mt-2 text-sm text-muted">
          Je bent ingelogd, maar zit nog niet in een squad. Start een nieuwe Winter Arc of gebruik de uitnodigingslink van je vrienden.
        </p>
      </div>
      <OnboardingForms
        challengeLabel={`${formatDateNl(DEFAULT_CHALLENGE.start_date, { day: "numeric", month: "long" })} t/m ${formatDateNl(DEFAULT_CHALLENGE.end_date, { day: "numeric", month: "long", year: "numeric" })}`}
      />
      <form action="/auth/signout" method="post" className="mt-10 text-center">
        <button type="submit" className="text-sm text-muted underline-offset-4 hover:underline">
          Uitloggen
        </button>
      </form>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
