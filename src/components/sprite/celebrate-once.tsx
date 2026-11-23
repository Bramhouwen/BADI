"use client";

import { useEffect } from "react";
import { celebrate, type CelebrationKind } from "@/lib/celebrate";

/** Plays a celebration once per `id` in this browser session, e.g. on the page you land on after finishing a workout. */
export function CelebrateOnce({ kind, id }: { kind: CelebrationKind; id: string }) {
  useEffect(() => {
    const key = `badi:celebrated:${kind}:${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // Without storage it may play again on a reload, which is harmless.
    }
    // Marked only when it actually plays, so a cancelled first run does not swallow it.
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(key, "1");
      } catch {}
      celebrate(kind);
    }, 400);
    return () => clearTimeout(t);
  }, [kind, id]);
  return null;
}
