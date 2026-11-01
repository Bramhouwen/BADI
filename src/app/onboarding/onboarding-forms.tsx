"use client";

import { useState, useTransition } from "react";
import { Link2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorText, Input, Label } from "@/components/ui/field";
import { acceptInvitation, createChallenge } from "@/app/actions/group";

export function OnboardingForms({ challengeLabel }: { challengeLabel: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<"create" | "join" | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start gap-3">
          <div className="tile flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <Link2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">Ik heb een uitnodiging</h2>
            <p className="mt-0.5 text-sm text-muted">Plak de link of code die je van de beheerder kreeg.</p>
            <form
              className="mt-3 space-y-3"
              action={(fd) => {
                setError(null);
                setWhich("join");
                start(async () => {
                  const r = await acceptInvitation(fd);
                  if (r && !r.ok) setError(r.error);
                });
              }}
            >
              <div>
                <Label htmlFor="token">Uitnodigingslink</Label>
                <Input id="token" name="token" placeholder="https://.../invite/..." autoComplete="off" required />
              </div>
              <Button type="submit" className="w-full" loading={pending && which === "join"}>
                Sluit je aan
              </Button>
            </form>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <div className="tile flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">Start een nieuwe Winter Arc</h2>
            <p className="mt-0.5 text-sm text-muted">
              Jij wordt beheerder en nodigt daarna drie vrienden uit. Periode: {challengeLabel}.
            </p>
            <form
              className="mt-3"
              action={() => {
                setError(null);
                setWhich("create");
                start(async () => {
                  const r = await createChallenge();
                  if (r && !r.ok) setError(r.error);
                });
              }}
            >
              <Button type="submit" variant="secondary" className="w-full" loading={pending && which === "create"}>
                Maak de squad aan
              </Button>
            </form>
          </div>
        </div>
      </Card>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
