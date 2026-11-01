import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="tile flex h-16 w-16 items-center justify-center rounded-full">
        <WifiOff className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-xl font-bold">Even geen verbinding</h1>
      <p className="mt-2 max-w-xs text-sm text-muted">
        BADI heeft internet nodig om je squad te zien. Je check-in wacht gewoon op je zodra je weer online bent.
      </p>
      {/* Full reload on purpose: retries the network instead of the client router cache. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="mt-6 rounded-2xl bg-water-deep px-5 py-3 font-semibold text-bg">
        Opnieuw proberen
      </a>
    </main>
  );
}
