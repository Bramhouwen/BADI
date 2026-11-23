import { getContext } from "@/lib/data";
import { spriteFor } from "@/lib/sprites";
import { Celebrations } from "./celebrations";

/** Mounts the celebration overlay for members who have a character. */
export async function CelebrationsJoin() {
  const ctx = await getContext();
  const sheet = ctx ? spriteFor(ctx.profile.display_name) : null;
  return sheet ? <Celebrations sheet={sheet} /> : null;
}
