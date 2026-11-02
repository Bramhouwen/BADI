import { AppHeader } from "@/components/app/header";
import { Suspense } from "react";
import { BottomNav } from "@/components/app/bottom-nav";
import { SquadUnreadDot } from "@/components/app/squad-unread";
import { BaddyBubble } from "@/components/coach/baddy-bubble";
import { PresenceJoin } from "@/components/app/presence";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="flex-1" style={{ paddingBottom: "calc(var(--nav-h) + var(--sab) + 20px)" }}>
        {children}
      </main>
      <BaddyBubble />
      <Suspense fallback={null}>
        <PresenceJoin />
      </Suspense>
      <BottomNav
        squadBadge={
          <Suspense fallback={null}>
            <SquadUnreadDot />
          </Suspense>
        }
      />
    </div>
  );
}
