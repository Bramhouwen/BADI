"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function isChatPath(path: string | null): boolean {
  return Boolean(path && (path === "/squad/chat" || path.startsWith("/squad/chat/") || path === "/coach"));
}

/** World of Badi fills the whole screen, like a game, with its own back button. */
export function isFullscreenPath(path: string | null): boolean {
  return path === "/wereld";
}

function Gate({ children }: { children: ReactNode }) {
  const path = usePathname();
  return isChatPath(path) || isFullscreenPath(path) ? null : <>{children}</>;
}

/** Hides the app header and tab bar inside a conversation, like a messenger, and in the world. */
export function HideOnChat({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
