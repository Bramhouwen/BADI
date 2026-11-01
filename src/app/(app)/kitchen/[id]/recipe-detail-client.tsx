"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { ReactionBar, type ReactionState } from "@/components/app/reaction-bar";
import { deleteRecipe, setRecipeReaction } from "@/app/actions/recipes";
import { useToast } from "@/components/ui/toast";
import { ErrorText } from "@/components/ui/field";

export function RecipeReactions({ recipeId, state }: { recipeId: string; state: ReactionState }) {
  const toast = useToast();
  return (
    <ReactionBar
      state={state}
      onSet={async (r) => {
        const res = await setRecipeReaction(recipeId, r);
        if (!res.ok) toast(res.error, "error");
      }}
    />
  );
}

export function DeleteRecipeButton({ recipeId }: { recipeId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="pt-4">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Recept verwijderen? Dit kan niet ongedaan worden gemaakt.")) return;
          start(async () => {
            const r = await deleteRecipe(recipeId);
            if (r && !r.ok) setError(r.error);
          });
        }}
        className="mx-auto flex items-center gap-1.5 text-xs text-muted hover:text-danger"
      >
        <Trash2 className="h-3.5 w-3.5" /> Recept verwijderen
      </button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
