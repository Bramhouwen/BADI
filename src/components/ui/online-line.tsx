"use client";

import { useIsOnline } from "@/lib/presence";

/** "Nu online" and this week's points, under a member's name. */
export function OnlineLine({ userId, week }: { userId: string; week: string | null }) {
  const online = useIsOnline(userId);
  if (!online && !week) return null;
  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
      {online ? (
        <>
          <span className="h-2 w-2 rounded-full bg-[#4caf6a]" aria-hidden />
          <span className="font-medium text-ink">Nu online</span>
          {week ? <span aria-hidden>·</span> : null}
        </>
      ) : null}
      {week ? <span>{week}</span> : null}
    </p>
  );
}
