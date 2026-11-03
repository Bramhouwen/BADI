import { Suspense } from "react";
import Link from "next/link";
import { Link2 } from "lucide-react";
import { requireContext } from "@/lib/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { RecipeForm } from "../recipe-form";
import { createRecipe } from "@/app/actions/recipes";

export const metadata = { title: "Nieuw recept" };

async function Content() {
  const ctx = await requireContext();
  return (
    <Page>
      <PageTitle title="Nieuw recept" subtitle="Niets is verplicht. Een naam of foto is genoeg." back="/kitchen" />
      <Link href="/kitchen/import" className="soft -mt-1 mb-5 flex items-center gap-2 rounded-full px-4 py-2.5">
        <Link2 className="h-4 w-4 text-ink" strokeWidth={1.7} aria-hidden />
        <span className="flex-1 text-[13px] font-medium text-ink">Importeren van link, tekst of screenshot</span>
      </Link>
      <RecipeForm action={createRecipe} pathPrefix={`${ctx.challenge.id}/${ctx.userId}`} submitLabel="Recept delen" />
    </Page>
  );
}

export default function NewRecipePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
