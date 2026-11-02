"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ErrorText, Hint, Input, Label, Textarea, inputClass } from "@/components/ui/field";
import { ImagePicker } from "@/components/app/image-picker";
import { RECIPE_CATEGORIES } from "@/lib/constants";
import type { Recipe } from "@/lib/types";
import type { ActionResult } from "@/lib/types";

export function RecipeForm({
  action,
  pathPrefix,
  recipe,
  imageUrl,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  pathPrefix: string;
  recipe?: Recipe;
  imageUrl?: string | null;
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        // Submitting by hand keeps the typed text in place when the server reports an error.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const r = await action(fd);
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <ImagePicker bucket="recipes" pathPrefix={pathPrefix} initialUrl={imageUrl} initialPath={recipe?.image_path} aspect="wide" label="Foto van je gerecht (optioneel)" />

      <div>
        <Label htmlFor="title">Naam van het recept</Label>
        <Input id="title" name="title" defaultValue={recipe?.title} placeholder="Protein Pancakes 🥞" maxLength={80} />
        <Hint>Zonder naam krijgt het recept je voornaam als titel.</Hint>
      </div>

      <div>
        <Label htmlFor="description">Korte omschrijving</Label>
        <Textarea id="description" name="description" defaultValue={recipe?.description ?? ""} placeholder="Waarom is dit lekker, snel of handig?" maxLength={500} className="min-h-[72px]" />
      </div>

      <div>
        <Label htmlFor="ingredients">Ingrediënten</Label>
        <Textarea id="ingredients" name="ingredients" defaultValue={recipe?.ingredients ?? ""} placeholder={"200 g kwark\n2 eieren\n50 g havermout"} maxLength={2000} />
        <Hint>Eén ingrediënt per regel.</Hint>
      </div>

      <div>
        <Label htmlFor="instructions">Bereiding (optioneel)</Label>
        <Textarea id="instructions" name="instructions" defaultValue={recipe?.instructions ?? ""} placeholder="Alles mixen, bakken in een hete pan, klaar." maxLength={4000} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="category">Categorie</Label>
          <select id="category" name="category" defaultValue={recipe?.category ?? ""} className={inputClass + " appearance-none"}>
            <option value="">Geen</option>
            {RECIPE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="protein_grams">Eiwit (g, optioneel)</Label>
          <Input id="protein_grams" name="protein_grams" type="number" inputMode="numeric" min={0} max={300} defaultValue={recipe?.protein_grams ?? ""} placeholder="±30" />
        </div>
      </div>

      <ErrorText>{error}</ErrorText>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
