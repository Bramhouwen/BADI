"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/field";
import { removePushSubscription, savePushSubscription, sendCoachTestPush, updateNotificationSetting } from "@/app/actions/push";
import { useToast } from "@/components/ui/toast";
import { NOTIFICATION_KINDS, NOTIFICATION_LABELS, type NotificationSettings } from "@/lib/notification-kinds";
import { cn } from "@/lib/utils";

type DeviceState = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function base64ToUint8(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function currentDeviceState(): Promise<DeviceState> {
  if (typeof window === "undefined") return "checking";
  if (isIos() && !isStandalone()) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? "on" : "off";
}

export async function enablePushOnThisDevice(publicKey: string): Promise<{ ok: boolean; error?: string }> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "Je hebt meldingen niet toegestaan. Dat kun je later in je instellingen aanpassen." };
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8(publicKey) }));
  const r = await savePushSubscription(sub.toJSON());
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** Push notifications for this device, plus which kinds the member wants. */
export function PushSettings({ publicKey, initial }: { publicKey: string | null; initial: NotificationSettings }) {
  const [state, setState] = useState<DeviceState>("checking");
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  function test(slot: "morning" | "evening") {
    setError(null);
    start(async () => {
      const r = await sendCoachTestPush(slot);
      if (!r.ok) setError(r.error);
      else toast(`Testbericht verstuurd naar ${r.data!.devices} ${r.data!.devices === 1 ? "apparaat" : "apparaten"}.`, "success");
    });
  }

  useEffect(() => {
    let alive = true;
    currentDeviceState().then((s) => alive && setState(s)).catch(() => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, []);

  function enable() {
    if (!publicKey) return;
    setError(null);
    start(async () => {
      const r = await enablePushOnThisDevice(publicKey);
      if (!r.ok) setError(r.error ?? "Aanzetten is niet gelukt.");
      setState(await currentDeviceState());
    });
  }

  function disable() {
    setError(null);
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });
  }

  function toggle(kind: (typeof NOTIFICATION_KINDS)[number]) {
    const next = !settings[kind];
    setSettings((s) => ({ ...s, [kind]: next }));
    start(async () => {
      const r = await updateNotificationSetting(kind, next);
      if (!r.ok) {
        setSettings((s) => ({ ...s, [kind]: !next }));
        setError(r.error);
      }
    });
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="soft flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <BellRing className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </span>
        <div className="min-w-0 flex-1 text-[13px] leading-snug">
          {!publicKey ? (
            <p className="text-muted">Pushmeldingen zijn nog niet ingesteld door de beheerder.</p>
          ) : state === "on" ? (
            <p className="text-text">Meldingen staan aan op dit apparaat.</p>
          ) : state === "ios-install" ? (
            <p className="text-muted">Op een iPhone werken meldingen alleen als je BADI via Safari op je beginscherm zet en vanaf daar opent.</p>
          ) : state === "denied" ? (
            <p className="text-muted">Meldingen zijn geblokkeerd voor BADI. Zet ze aan in de instellingen van je telefoon of browser.</p>
          ) : state === "unsupported" ? (
            <p className="text-muted">Deze browser ondersteunt geen pushmeldingen.</p>
          ) : (
            <p className="text-muted">Krijg een melding op je telefoon, ook als BADI dicht is.</p>
          )}
        </div>
      </div>

      {publicKey && state === "off" ? (
        <Button className="w-full" onClick={enable} loading={pending}>
          Zet meldingen aan
        </Button>
      ) : null}

      <ul className="divide-y divide-ink/[0.06]">
        {NOTIFICATION_KINDS.map((k) => (
          <li key={k}>
            <label className="flex cursor-pointer items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-text">{NOTIFICATION_LABELS[k].label}</span>
                <span className="block text-[11.5px] text-muted">{NOTIFICATION_LABELS[k].hint}</span>
              </span>
              <input type="checkbox" className="peer sr-only" checked={settings[k]} onChange={() => toggle(k)} disabled={pending} />
              <span aria-hidden className={cn("relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-sage/60", settings[k] ? "bg-sage" : "bg-ink/15")}>
                <span className={cn("absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all", settings[k] ? "left-[21px]" : "left-[3px]")} />
              </span>
            </label>
          </li>
        ))}
      </ul>

      {state === "on" ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={() => test("morning")} disabled={pending}>
            Test ochtend
          </Button>
          <Button variant="secondary" size="sm" onClick={() => test("evening")} disabled={pending}>
            Test avond
          </Button>
        </div>
      ) : null}

      {state === "on" ? (
        <button type="button" onClick={disable} disabled={pending} className="w-full text-center text-[12.5px] font-medium text-muted underline-offset-2 hover:underline">
          Zet meldingen uit op dit apparaat
        </button>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
