import { AppHeader } from "@/components/app/header";
import { BottomNav } from "@/components/app/bottom-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="flex-1" style={{ paddingBottom: "calc(var(--nav-h) + var(--sab) + 20px)" }}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
