import { Suspense } from "react";
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
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-5 pb-10" style={{ paddingTop: "calc(var(--sat) + 40px)" }}>
      <div className="mb-8 text-center">
        <div className="tile mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] text-2xl">
          <span aria-hidden>❄️</span>
        </div>
        <h1 className="text-2xl font-bold">Welkom bij Winter Arc</h1>
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
