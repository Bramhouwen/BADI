import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { RecipeForm } from "../../recipe-form";
import { updateRecipe } from "@/app/actions/recipes";
import type { Recipe } from "@/lib/types";

export const metadata = { title: "Recept bewerken" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase.from("recipes").select("*").eq("id", id).eq("user_id", ctx.userId).maybeSingle();
  if (!data) notFound();
  const recipe = data as Recipe;
  const image = await signedUrl("recipes", recipe.image_path);
  const action = updateRecipe.bind(null, recipe.id);
  return (
    <Page>
      <PageTitle title="Recept bewerken" back={`/kitchen/${recipe.id}`} />
      <RecipeForm action={action} pathPrefix={`${ctx.challenge.id}/${ctx.userId}`} recipe={recipe} imageUrl={image} submitLabel="Wijzigingen opslaan" />
    </Page>
  );
}

export default function EditRecipePage({ params }: PageProps<"/kitchen/[id]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
