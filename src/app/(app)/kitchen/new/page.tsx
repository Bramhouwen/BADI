import { Suspense } from "react";
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
