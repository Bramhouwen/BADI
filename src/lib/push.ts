import "server-only";

import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDemo } from "@/lib/demo";

export type PushKind = "chat" | "direct" | "mentions" | "recipes" | "jokers" | "compliments" | "coach";

export interface PushPayload {
  title: string;
  body: string;
  /** Path inside the app that opens when the notification is tapped. */
  url: string;
  /** Notifications with the same tag replace each other on the device. */
  tag?: string;
  /** Image shown with the notification; defaults to the app icon. */
  icon?: string;
}

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Sends one payload to the given devices. Calls onGone for subscriptions the
 * push service reports as expired (404 or 410). Returns how many succeeded.
 */
export async function sendToSubscriptions(subs: PushSubscriptionKeys[], payload: PushPayload, onGone?: (endpoint: string) => PromiseLike<unknown>): Promise<number> {
  const keys = vapid();
  if (!keys || isDemo() || subs.length === 0) return 0;
  const body = JSON.stringify(payload);
  let ok = 0;
  await Promise.all(
    subs.map(async (t) => {
      try {
        await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, body, {
          vapidDetails: { subject: keys.subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
          TTL: 60 * 60 * 12,
        });
        ok += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if ((status === 404 || status === 410) && onGone) await onGone(t.endpoint);
      }
    }),
  );
  return ok;
}

function vapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "https://badi-mu.vercel.app";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function pushConfigured(): boolean {
  return !isDemo() && vapid() !== null;
}

/**
 * Sends a push notification to the devices of other squad members that want
 * this kind of message. Runs with the sender's session; the database decides
 * who is reached (push_targets). Never throws: a failed push must not break
 * the action that triggered it.
 */
export async function sendPush(supabase: SupabaseClient, kind: PushKind, payload: PushPayload, opts: { only?: string; exclude?: string[] } = {}): Promise<void> {
  const keys = vapid();
  if (!keys || isDemo()) return;
  try {
    const { data } = await supabase.rpc("push_targets", { p_kind: kind, p_only: opts.only ?? null });
    const exclude = new Set(opts.exclude ?? []);
    const targets = ((data ?? []) as { user_id: string; endpoint: string; p256dh: string; auth: string }[]).filter((t) => !exclude.has(t.user_id));
    if (!targets.length) return;
    await sendToSubscriptions(targets, { ...payload, tag: payload.tag ?? kind }, (endpoint) => supabase.rpc("forget_push_endpoint", { p_endpoint: endpoint }));
  } catch {
    // Notifications are best effort.
  }
}
