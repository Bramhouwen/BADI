import { getContext } from "@/lib/data";
import { memberSprite } from "@/lib/sprites-server";
import { Celebrations } from "./celebrations";

/** Mounts the celebration overlay for members who have a character. */
export async function CelebrationsJoin() {
  const ctx = await getContext();
  const sheet = ctx ? await memberSprite(ctx.challenge.id, ctx.profile.display_name) : null;
  return sheet ? <Celebrations sheet={sheet} /> : null;
}
