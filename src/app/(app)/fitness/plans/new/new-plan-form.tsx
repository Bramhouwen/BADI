"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ErrorText, Hint, Input, Label, Textarea } from "@/components/ui/field";
import { createPlan } from "@/app/actions/fitness";

export function NewPlanForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const r = await createPlan(fd);
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <div>
        <Label htmlFor="name">Naam</Label>
        <Input id="name" name="name" placeholder="Bijv. Full body" maxLength={60} required autoFocus />
        <Hint>Voorbeelden: Full Body, Upper Body, Lower Body, 5 km-plan.</Hint>
      </div>
      <div>
        <Label htmlFor="goal">Doel (optioneel)</Label>
        <Input id="goal" name="goal" placeholder="Bijv. drie keer per week kracht" maxLength={120} />
      </div>
      <div>
        <Label htmlFor="description">Beschrijving (optioneel)</Label>
        <Textarea id="description" name="description" maxLength={500} className="min-h-[72px]" />
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Schema aanmaken
      </Button>
    </form>
  );
}
