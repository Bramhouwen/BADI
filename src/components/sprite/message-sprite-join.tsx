import { getContext, getSquad } from "@/lib/data";
import { spriteFor } from "@/lib/sprites";
import { firstName } from "@/lib/utils";
import { MessageSprite } from "./message-sprite";

/** Mounts the listener that brings in the sender's character with a new message. */
export async function MessageSpriteJoin() {
  const ctx = await getContext();
  if (!ctx) return null;
  const squad = await getSquad(ctx.challenge.id);
  const senders = squad
    .filter((m) => m.user_id !== ctx.userId)
    .map((m) => ({ id: m.user_id, name: firstName(m.profile.display_name), sheet: spriteFor(m.profile.display_name) }))
    .filter((m): m is { id: string; name: string; sheet: NonNullable<typeof m.sheet> } => m.sheet !== null);
  if (senders.length === 0) return null;
  return <MessageSprite me={ctx.userId} challengeId={ctx.challenge.id} senders={senders} />;
}
