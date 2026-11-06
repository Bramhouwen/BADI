"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { completeChallenge } from "@/app/actions/wheel";
import { Button } from "@/components/ui/button";

/** For challenges the app cannot check itself: the member marks it done. */
export function ChallengeDoneButton({ spinId }: { spinId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1.5">
      <Button
        size="sm"
        loading={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await completeChallenge(spinId);
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
      >
        {pending ? null : <Check className="h-4 w-4" strokeWidth={2.2} aria-hidden />}
        Gedaan
      </Button>
      {error ? (
        <p className="text-[12.5px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
