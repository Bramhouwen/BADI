import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";
import { Pencil, ChefHat } from "lucide-react";
import { getSquad, requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { Page } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { Card, SectionTitle } from "@/components/ui/card";
import { formatDateTimeNl } from "@/lib/dates";
import { FavoriteButton } from "../recipe-card";
import { RecipeReactions, DeleteRecipeButton } from "./recipe-detail-client";
import type { Recipe, PostReaction } from "@/lib/types";
import type { ReactionKey } from "@/lib/constants";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data: recipeRow } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (!recipeRow) notFound();
  const recipe = recipeRow as Recipe;
  const [squad, image, { data: favRow }, { data: reactionRows }] = await Promise.all([
    getSquad(ctx.challenge.id),
    signedUrl("recipes", recipe.image_path),
    supabase.from("recipe_favorites").select("id").eq("recipe_id", id).eq("user_id", ctx.userId).maybeSingle(),
    supabase.from("recipe_reactions").select("user_id, reaction").eq("recipe_id", id),
  ]);
  const member = squad.find((m) => m.user_id === recipe.user_id)?.profile;
  const byCoach = Boolean((recipe as { by_coach?: boolean }).by_coach);
  const author = byCoach ? { display_name: "Baddy", avatar_path: null } : member;
  const authorAvatar = byCoach ? "/brand/baddy.png" : await signedUrl("avatars", member?.avatar_path);
  const reactions = (reactionRows ?? []) as Pick<PostReaction, "user_id" | "reaction">[];
  const counts: Partial<Record<ReactionKey, number>> = {};
  for (const r of reactions) counts[r.reaction] = (counts[r.reaction] ?? 0) + 1;
  const mine = reactions.find((r) => r.user_id === ctx.userId)?.reaction ?? null;
  const isOwner = recipe.user_id === ctx.userId;
  const ingredients = (recipe.ingredients ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-lg pb-6">
      <div className={cn("relative mx-4 mt-1 overflow-hidden rounded-[28px] border border-ink/10 bg-white/70", image ? "aspect-[4/4]" : "aspect-[16/9] bg-gradient-to-br from-[#e9d6c7] to-[#d9bfae]")}>
        {image ? (
          <Image src={image} alt={recipe.title} fill priority sizes="(max-width: 512px) 100vw, 512px" className="object-cover" unoptimized />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ChefHat className="h-12 w-12 text-ink/50" strokeWidth={1.2} aria-hidden />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <Link href="/kitchen" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur" aria-label="Terug naar Kitchen">
            ←
          </Link>
          <div className="flex gap-2">
            {isOwner ? (
              <Link href={`/kitchen/${recipe.id}/edit`} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur" aria-label="Recept bewerken">
                <Pencil className="h-4 w-4" />
              </Link>
            ) : null}
            <FavoriteButton recipeId={recipe.id} favorite={Boolean(favRow)} large />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2b1a14]/90 via-[#2b1a14]/40 to-transparent px-4 pb-4 pt-16">
          {recipe.category ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-water-deep">{recipe.category}</p> : null}
          <h1 className="text-2xl font-bold leading-tight">{recipe.title}</h1>
        </div>
      </div>

      <Page className="space-y-5 pt-3">
        <div className="flex items-center gap-3">
          <Avatar name={author?.display_name ?? "Lid"} src={authorAvatar} size="sm" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">{author?.display_name ?? "Lid"}</p>
            <p className="text-xs text-muted">{formatDateTimeNl(recipe.created_at, ctx.challenge.timezone)}</p>
          </div>
          {recipe.protein_grams != null ? (
            <span className="soft rounded-full px-3 py-1.5 text-xs font-medium">
              ±{recipe.protein_grams} g eiwit
            </span>
          ) : null}
        </div>

        {recipe.description ? <p className="text-[15px] leading-relaxed text-text/90">{recipe.description}</p> : null}

        <RecipeReactions recipeId={recipe.id} state={{ counts, mine }} />

        {ingredients.length > 0 ? (
          <section>
            <SectionTitle>Ingrediënten</SectionTitle>
            <Card>
              <ul className="space-y-2">
                {ingredients.map((line, i) => (
                  <li key={i} className="flex gap-3 text-[15px]">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-water-deep" aria-hidden />
                    <span>{line.replace(/^[-*•]\s*/, "")}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}

        {recipe.instructions ? (
          <section>
            <SectionTitle>Bereiding</SectionTitle>
            <Card>
              <p className="whitespace-pre-line text-[15px] leading-relaxed">{recipe.instructions}</p>
            </Card>
          </section>
        ) : null}

        {isOwner ? <DeleteRecipeButton recipeId={recipe.id} /> : null}
      </Page>
    </div>
  );
}

export default function RecipePage({ params }: PageProps<"/kitchen/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

export const metadata = { title: "Recept" };
