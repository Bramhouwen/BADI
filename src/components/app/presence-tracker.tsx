"use client";

import { useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { receiveTyping, registerTypingSender, setOnline } from "@/lib/presence";
import { DEMO_ONLINE_IDS, isDemo } from "@/lib/demo";

/**
 * Joins the squad's presence channel while the app is open and visible, and
 * keeps the shared online list up to date. Leaving the app or hiding it
 * removes you from the list.
 */
export function PresenceTracker({ userId, challengeId }: { userId: string; challengeId: string }) {
  useEffect(() => {
    if (isDemo()) {
      setOnline(DEMO_ONLINE_IDS);
      return;
    }
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    const channel: RealtimeChannel = supabase.channel(`online:${challengeId}`, { config: { presence: { key: userId } } });
    const sync = () => setOnline(Object.keys(channel.presenceState()));
    const track = () => {
      if (document.visibilityState === "visible") void channel.track({ at: new Date().toISOString() });
      else void channel.untrack();
    };
    channel
      .on("presence", { event: "sync" }, sync)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as { from?: string; to?: string };
        if (!p?.from || p.from === userId) return;
        // Group typing is for everyone; private typing only for the recipient.
        if (p.to === "squad") receiveTyping("squad", p.from);
        else if (p.to === userId) receiveTyping(`dm:${p.from}`, p.from);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") track();
      });
    registerTypingSender((to) => void channel.send({ type: "broadcast", event: "typing", payload: { from: userId, to } }));
    document.addEventListener("visibilitychange", track);
    return () => {
      document.removeEventListener("visibilitychange", track);
      registerTypingSender(null);
      void channel.untrack();
      void supabase.removeChannel(channel);
      setOnline([]);
    };
  }, [userId, challengeId]);

  return null;
}
