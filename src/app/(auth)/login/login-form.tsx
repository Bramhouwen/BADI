"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, Input, Label } from "@/components/ui/field";
import { sendMagicLink, signInWithPassword, signUpWithPassword } from "@/app/actions/auth";
import { ChipTabs } from "@/components/ui/page";

type Mode = "magic" | "password" | "signup";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const linkError = params.get("error") === "link";
  const [mode, setMode] = useState<Mode>("magic");
  const [error, setError] = useState<string | null>(linkError ? "Die link werkt niet meer. Vraag een nieuwe aan." : null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      if (mode === "magic") {
        const r = await sendMagicLink(formData);
        if (!r.ok) setError(r.error);
        else setSent("magic");
      } else if (mode === "password") {
        const r = await signInWithPassword(formData);
        if (r && !r.ok) setError(r.error);
      } else {
        const r = await signUpWithPassword(formData);
        if (r && !r.ok) setError(r.error);
        else if (r && r.ok) setSent("confirm");
      }
    });
  }

  if (sent) {
    return (
      <div className="glass rounded-[28px] p-6 text-center">
        <MailCheck className="mx-auto h-8 w-8 text-ice" />
        <h2 className="mt-3 text-lg font-semibold">Check je mail</h2>
        <p className="mt-1 text-sm text-muted">
          {sent === "magic"
            ? "We hebben je een inloglink gestuurd. Open hem op je telefoon en je bent binnen."
            : "Bevestig je e-mailadres via de link in je inbox. Daarna kun je inloggen."}
        </p>
        <Button variant="ghost" className="mt-4" onClick={() => setSent(null)}>
          Terug
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <ChipTabs
          label="Inlogmethode"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
          options={[
            { key: "magic", label: "Magic link" },
            { key: "password", label: "Wachtwoord" },
            { key: "signup", label: "Account" },
          ]}
        />
      </div>

      <form action={submit} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" ? (
          <div>
            <Label htmlFor="display_name">Voornaam</Label>
            <Input id="display_name" name="display_name" autoComplete="given-name" placeholder="Bijv. Sam" required maxLength={40} />
          </div>
        ) : null}
        <div>
          <Label htmlFor="email">E-mailadres</Label>
          <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="jij@voorbeeld.nl" required />
        </div>
        {mode !== "magic" ? (
          <div>
            <Label htmlFor="password">Wachtwoord</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder={mode === "signup" ? "Minimaal 8 tekens" : "Je wachtwoord"}
              required
              minLength={mode === "signup" ? 8 : 1}
            />
          </div>
        ) : null}
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {mode === "magic" ? "Stuur inloglink" : mode === "password" ? "Inloggen" : "Account aanmaken"}
        </Button>
        <p className="text-center text-xs text-muted">
          {mode === "magic"
            ? "Geen wachtwoord nodig. Je krijgt een link per mail."
            : mode === "signup"
              ? "Alleen met een uitnodiging van je squad kom je in de groep."
              : "Liever zonder wachtwoord? Kies Magic link."}
        </p>
      </form>
    </div>
  );
}
