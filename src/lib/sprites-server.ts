import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { sheetFor, type SpriteSheet } from "./sprites";

/** Names of the characters the admin released in this challenge. */
export const releasedSprites = cache(async (challengeId: string): Promise<Set<string>> => {
  const supabase = await createClient();
  const { data } = await supabase.from("sprite_releases").select("sprite").eq("challenge_id", challengeId);
  return new Set(((data ?? []) as { sprite: string }[]).map((r) => r.sprite));
});

/** A member's live character, or null. */
export async function memberSprite(challengeId: string, displayName: string | null | undefined): Promise<SpriteSheet | null> {
  return sheetFor(displayName, await releasedSprites(challengeId));
}

/** Notification icon for a push from this member: their character's face, or the app icon. */
export async function memberPushIcon(challengeId: string, displayName: string | null | undefined): Promise<string | undefined> {
  return (await memberSprite(challengeId, displayName))?.face;
}
