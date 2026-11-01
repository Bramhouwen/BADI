"use client";

import Link from "next/link";
import Image from "next/image";
import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Avatar } from "@/components/ui/avatar";
import { toggleFavorite } from "@/app/actions/recipes";
import { cn, firstName } from "@/lib/utils";

export function FavoriteButton({ recipeId, favorite, className, large }: { recipeId: string; favorite: boolean; className?: string; large?: boolean }) {
  const [pending, start] = useTransition();
  const reduce = useReducedMotion();
  const [opt, setOpt] = useOptimistic(favorite, (_prev: boolean, next: boolean) => next);
  return (
    <motion.button
      type="button"
      aria-pressed={opt}
      aria-label={opt ? "Verwijder uit favorieten" : "Bewaar als favoriet"}
      disabled={pending}
      whileTap={reduce ? undefined : { scale: 0.85 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          setOpt(!opt);
          await toggleFavorite(recipeId, !opt);
        });
      }}
      className={cn(
        "flex items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition",
        large ? "h-12 w-12" : "h-9 w-9",
        className,
      )}
    >
      <motion.span animate={opt && !reduce ? { scale: [1, 1.3, 1] } : { scale: 1 }} transition={{ duration: 0.3 }}>
        <Heart className={cn(large ? "h-6 w-6" : "h-4.5 w-4.5", opt && "fill-[#fb7185] text-[#fb7185]")} />
      </motion.span>
    </motion.button>
  );
}

export function RecipeCard({
  recipe,
  imageUrl,
  author,
  favorite,
}: {
  recipe: { id: string; title: string; category: string | null };
  imageUrl: string | null;
  author: { name: string; avatar: string | null };
  favorite: boolean;
}) {
  return (
    <Link href={`/kitchen/${recipe.id}`} className="group relative block overflow-hidden rounded-[24px] border border-white/20 bg-white/5">
      <div className="relative aspect-[4/5]">
        {imageUrl ? (
          <Image src={imageUrl} alt={recipe.title} fill sizes="(max-width: 512px) 50vw, 240px" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" unoptimized />
        ) : (
          <div className="skeleton absolute inset-0" />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b1f33]/90 via-[#0b1f33]/40 to-transparent p-3 pt-10">
          {recipe.category ? <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-ice">{recipe.category}</p> : null}
          <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">{recipe.title}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Avatar name={author.name} src={author.avatar} size="xs" />
            <span className="text-xs text-white/80">{firstName(author.name)}</span>
          </div>
        </div>
        <FavoriteButton recipeId={recipe.id} favorite={favorite} className="absolute right-2 top-2" />
      </div>
    </Link>
  );
}
