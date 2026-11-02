"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function isChatPath(path: string | null): boolean {
  return Boolean(path && (path === "/squad/chat" || path.startsWith("/squad/chat/") || path === "/coach"));
}

function Gate({ children }: { children: ReactNode }) {
  const path = usePathname();
  return isChatPath(path) ? null : <>{children}</>;
}

/** Hides the app header and tab bar inside a conversation, like a messenger. */
export function HideOnChat({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
