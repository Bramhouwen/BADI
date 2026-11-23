import { getContext, getSquad } from "@/lib/data";
import { sheetFor } from "@/lib/sprites";
import { releasedSprites } from "@/lib/sprites-server";
import { firstName } from "@/lib/utils";
import { MessageSprite } from "./message-sprite";

/** Mounts the listener that brings in the sender's character with a new message. */
export async function MessageSpriteJoin() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [squad, released] = await Promise.all([getSquad(ctx.challenge.id), releasedSprites(ctx.challenge.id)]);
  const senders = squad
    .filter((m) => m.user_id !== ctx.userId)
    .map((m) => ({ id: m.user_id, name: firstName(m.profile.display_name), sheet: sheetFor(m.profile.display_name, released) }))
    .filter((m): m is { id: string; name: string; sheet: NonNullable<typeof m.sheet> } => m.sheet !== null);
  if (senders.length === 0) return null;
  return <MessageSprite me={ctx.userId} challengeId={ctx.challenge.id} senders={senders} />;
}
