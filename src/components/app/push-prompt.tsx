"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, X } from "lucide-react";
import { currentDeviceState, enablePushOnThisDevice } from "@/app/(app)/profile/push-settings";
import { useToast } from "@/components/ui/toast";

const DISMISS_KEY = "badi:push-prompt-dismissed";

/** Small invitation in the squad chat to turn on push notifications on this device. */
export function PushPrompt({ publicKey }: { publicKey: string | null }) {
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  useEffect(() => {
    if (!publicKey) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (dismissed) return;
    let alive = true;
    currentDeviceState()
      .then((s) => alive && setShow(s === "off"))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [publicKey]);

  if (!show || !publicKey) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setShow(false);
  }

  return (
    <div className="soft flex items-center gap-3 rounded-[18px] py-2.5 pl-3 pr-2">
      <BellRing className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} />
      <p className="min-w-0 flex-1 text-[12.5px] leading-snug">Melding krijgen bij nieuwe berichten?</p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await enablePushOnThisDevice(publicKey);
            if (r.ok) {
              toast("Meldingen staan aan.", "success");
              setShow(false);
            } else toast(r.error ?? "Aanzetten is niet gelukt.", "error");
          })
        }
        className="espresso shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium shadow-none"
      >
        Zet aan
      </button>
      <button type="button" onClick={dismiss} aria-label="Niet nu" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink">
        <X className="h-4 w-4" strokeWidth={1.7} />
      </button>
    </div>
  );
}
