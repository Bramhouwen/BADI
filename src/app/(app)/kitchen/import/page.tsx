import { Suspense } from "react";
import { requireContext } from "@/lib/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ImportRecipe } from "./import-recipe";

export const metadata = { title: "Recept importeren" };

type Search = Promise<{ url?: string | string[]; text?: string | string[]; title?: string | string[] }>;

async function Content({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  // The Android share menu sends the link in url or inside text, depending on the app.
  const shared = [one(sp.url), one(sp.text)].filter(Boolean).join("\n").slice(0, 8000);
  return (
    <Page>
      <PageTitle title="Recept importeren" subtitle="Van een link, tekst of screenshot." back="/kitchen" />
      <ImportRecipe pathPrefix={`${ctx.challenge.id}/${ctx.userId}`} shared={shared} />
    </Page>
  );
}

export default function ImportRecipePage({ searchParams }: PageProps<"/kitchen/import">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
