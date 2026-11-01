import { Suspense } from "react";
import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata = { title: "Inloggen" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col px-5 pb-10" style={{ paddingTop: "calc(var(--sat) + 48px)" }}>
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-10 text-center">
          <Image src="/brand/logo-full-dark.png" alt="BADI, run squat" width={220} height={190} priority className="mx-auto h-auto w-[200px]" />
          <p className="mt-6 font-display text-[22px] text-text">Vier vrienden, één winter.</p>
          <p className="mt-1 text-[14px] text-muted">Show up for yourself, inspire the others.</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
