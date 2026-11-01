import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Inloggen" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col px-5 pb-10" style={{ paddingTop: "calc(var(--sat) + 48px)" }}>
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-card text-3xl shadow-[var(--shadow-glow)]">
            <span aria-hidden>❄️</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-[0.06em]">WINTER ARC</h1>
          <p className="mt-1 text-xs font-semibold tracking-[0.24em] text-ice">BETTER TOGETHER</p>
          <p className="mt-5 text-sm text-muted">Vier vrienden, één winter. Show up for yourself, inspire the others.</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
