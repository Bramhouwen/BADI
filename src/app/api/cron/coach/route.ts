import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/supabase/env";
import { TIMEZONE } from "@/lib/constants";
import { hourInTz, todayKey } from "@/lib/dates";
import { dailyMessage, slotFromHour, type CoachSlot } from "@/lib/coach/daily";
import { pushConfigured, sendToSubscriptions, type PushSubscriptionKeys } from "@/lib/push";
import { firstName } from "@/lib/utils";
import type { TrainingKind } from "@/lib/checkin-plan";

interface ClaimRow {
  user_id: string;
  name: string;
  start_date: string;
  end_date: string;
  checkin_dates: string[];
  today_activities: string[];
  joker_today: boolean;
  planned_today: TrainingKind[];
  subscriptions: PushSubscriptionKeys[] | null;
}

/**
 * Called by the Supabase schedule (pg_cron + pg_net) on both possible UTC hours.
 * Sends only at 07:00 and 21:00 in Amsterdam; the database checks the token and
 * hands out each member once per slot and day.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slot = url.searchParams.get("slot") as CoachSlot | null;
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || (slot !== "morning" && slot !== "evening")) return new Response("Unauthorized", { status: 401 });

  const now = new Date();
  if (slotFromHour(hourInTz(now, TIMEZONE)) !== slot) return Response.json({ skipped: "not this hour" });
  if (!pushConfigured()) return Response.json({ skipped: "push not configured" });

  const { url: supaUrl, key } = supabaseEnv();
  const supabase = createClient(supaUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const today = todayKey(now, TIMEZONE);
  const { data, error } = await supabase.rpc("coach_push_claim", { p_token: token, p_slot: slot, p_date: today });
  if (error) return new Response("Unauthorized", { status: 401 });

  let devices = 0;
  const rows = (data ?? []) as ClaimRow[];
  for (const row of rows) {
    const message = dailyMessage(
      {
        userId: row.user_id,
        firstName: firstName(row.name),
        today,
        startDate: row.start_date,
        endDate: row.end_date,
        checkinDates: row.checkin_dates ?? [],
        todayActivities: row.today_activities ?? [],
        jokerToday: row.joker_today,
        plannedToday: row.planned_today ?? [],
      },
      slot,
    );
    devices += await sendToSubscriptions(
      row.subscriptions ?? [],
      { ...message, url: slot === "morning" ? "/" : "/checkin", tag: `coach-${slot}`, icon: "/brand/baddy.jpg" },
      (endpoint) => supabase.rpc("coach_forget_endpoint", { p_token: token, p_endpoint: endpoint }),
    );
  }
  return Response.json({ members: rows.length, devices });
}
