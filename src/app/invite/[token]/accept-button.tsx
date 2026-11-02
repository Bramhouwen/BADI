"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/field";
import { acceptInvitation } from "@/app/actions/group";

export function AcceptInviteButton({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-6 w-full space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const r = await acceptInvitation(fd);
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <input type="hidden" name="token" value={token} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Ik doe mee ❄️
      </Button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
