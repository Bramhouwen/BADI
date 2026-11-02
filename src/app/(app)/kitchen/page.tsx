import { Suspense } from "react";
import Link from "next/link";
import { getSquad, requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrlMap } from "@/lib/storage";
import { Page, PageTitle } from "@/components/ui/page";
import { RECIPE_CATEGORIES, RECIPE_CATEGORY_LABELS, type RecipeCategory } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ChefHat, Heart } from "lucide-react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/app/fab";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { RecipeCard } from "./recipe-card";
import type { Recipe } from "@/lib/types";

export const metadata = { title: "Kitchen" };

type Filter = "all" | "favorites" | RecipeCategory;

async function Content({ searchParams }: { searchParams: Promise<{ filter?: string | string[] }> }) {
  const sp = await searchParams;
  const raw = typeof sp.filter === "string" ? sp.filter : "all";
  const filter: Filter = raw === "favorites" || (RECIPE_CATEGORIES as readonly string[]).includes(raw) ? (raw as Filter) : "all";
  const ctx = await requireContext();
  const supabase = await createClient();
  const [squad, { data: recipeRows }, { data: favRows }] = await Promise.all([
    getSquad(ctx.challenge.id),
    supabase.from("recipes").select("*").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }),
    supabase.from("recipe_favorites").select("recipe_id").eq("user_id", ctx.userId),
  ]);
  const favorites = new Set((favRows ?? []).map((f) => f.recipe_id as string));
  const all = (recipeRows ?? []) as Recipe[];
  const recipes = filter === "favorites" ? all.filter((r) => favorites.has(r.id)) : filter === "all" ? all : all.filter((r) => r.category === filter);
  const [images, avatars] = await Promise.all([
    signedUrlMap("recipes", recipes.map((r) => r.image_path)),
    signedUrlMap("avatars", squad.map((m) => m.profile.avatar_path).filter((p): p is string => Boolean(p))),
  ]);
  const memberOf = (id: string) => squad.find((m) => m.user_id === id)?.profile;

  return (
    <Page>
      <RealtimeRefresher channel={`kitchen:${ctx.challenge.id}`} tables={["recipes"]} />
      <PageTitle title="Kitchen" subtitle="Recepten van de squad." />
      <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1" role="tablist" aria-label="Filter">
        {(
          [
            ["all", "Alles"],
            ...RECIPE_CATEGORIES.map((c) => [c, RECIPE_CATEGORY_LABELS[c]] as const),
            ["favorites", "Favorieten"],
          ] as const
        ).map(([key, label]) => {
          const active = filter === key;
          return (
            <Link
              key={key}
              role="tab"
              aria-selected={active}
              href={key === "all" ? "/kitchen" : `/kitchen?filter=${key}`}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-medium transition",
                active ? "espresso shadow-none" : "soft hover:bg-blush-2",
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {recipes.length === 0 ? (
        filter === "favorites" ? (
          <EmptyState icon={Heart} title="Nog geen favorieten" body="Tik op het hartje bij een recept om het hier te bewaren." />
        ) : filter !== "all" ? (
          <EmptyState icon={ChefHat} title={`Nog geen ${RECIPE_CATEGORY_LABELS[filter].toLowerCase()}`} body="Deel het eerste recept in deze categorie." />
        ) : (
          <EmptyState
            icon={ChefHat}
            title="De keuken is nog leeg"
            body="Deel het eerste recept. Een foto en een naam zijn genoeg."
            action={
              <Link href="/kitchen/new">
                <Button>Recept toevoegen</Button>
              </Link>
            }
          />
        )
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {recipes.map((r) => {
            const author = memberOf(r.user_id);
            return (
              <li key={r.id}>
                <RecipeCard
                  recipe={{ id: r.id, title: r.title, category: r.category }}
                  imageUrl={images.get(r.image_path) ?? null}
                  author={{ name: author?.display_name ?? "Lid", avatar: author?.avatar_path ? avatars.get(author.avatar_path) ?? null : null }}
                  favorite={favorites.has(r.id)}
                />
              </li>
            );
          })}
        </ul>
      )}
      <Fab href="/kitchen/new" label="Recept toevoegen" />
    </Page>
  );
}

export default function KitchenPage({ searchParams }: PageProps<"/kitchen">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
