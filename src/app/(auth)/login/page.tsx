import { Suspense } from "react";
import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata = { title: "Inloggen" };

export default function LoginPage() {
  return (
    <main className="min-h-dvh">
      <section className="relative h-[52dvh] min-h-[380px] w-full overflow-hidden">
        <Image src="/photos/login-hero.jpg" alt="" fill priority sizes="100vw" className="object-cover object-[50%_30%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#3b2a24]/35 via-[#3b2a24]/20 to-[#f6ece4]" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-8 text-center" style={{ paddingTop: "var(--sat)" }}>
          <Image src="/brand/logo-full.png" alt="BADI, run squat" width={150} height={125} priority className="h-auto w-[140px] drop-shadow-[0_8px_24px_rgba(59,42,36,0.35)]" />
          <p className="mt-5 font-display text-[30px] italic leading-tight text-white drop-shadow-[0_2px_12px_rgba(59,42,36,0.5)]">
            Run further,
            <br />
            squat stronger
          </p>
          <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.28em] text-white/85">Vier vrienden, één winter</p>
        </div>
      </section>
      <section className="-mt-6 px-5 pb-10">
        <div className="mx-auto w-full max-w-sm">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
