import { getContext } from "@/lib/data";
import { PresenceTracker } from "./presence-tracker";

/** Mounts the online tracker for signed-in squad members. */
export async function PresenceJoin() {
  const ctx = await getContext();
  if (!ctx) return null;
  return <PresenceTracker userId={ctx.userId} challengeId={ctx.challenge.id} />;
}
