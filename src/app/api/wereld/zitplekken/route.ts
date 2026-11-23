import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getContext } from "@/lib/data";
import { canSeeWorld } from "@/lib/world/types";

const pt = z.tuple([z.number().finite(), z.number().finite()]).transform(([x, y]): [number, number] => [Math.round(x), Math.round(y)]);
const bodySchema = z.object({
  scene: z.enum(["woonkamer", "kantoor", "sportschool", "buiten"]),
  seats: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,40}$/), hip: pt, facing: z.enum(["left", "right"]), approach: pt })).max(60),
});

/**
 * Saves the seats from the placement mode (/wereld?bewerken) to
 * src/lib/world/scenes/<scene>.zitplekken.json. Only on your own computer
 * (next dev) and only for the admin; in production the editor copies the
 * JSON to the clipboard instead.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") return Response.json({ error: "Alleen lokaal." }, { status: 404 });
  const ctx = await getContext();
  if (!ctx || !canSeeWorld(ctx.membership.role)) return Response.json({ error: "Geen toegang." }, { status: 403 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Ongeldige zitplekken." }, { status: 400 });
  const { scene, seats } = parsed.data;
  const file = path.join(process.cwd(), "src/lib/world/scenes", `${scene}.zitplekken.json`);
  const lines = seats.map((s) => "    " + JSON.stringify(s));
  await fs.writeFile(file, `{\n  "seats": [\n${lines.join(",\n")}\n  ]\n}\n`);
  return Response.json({ ok: true, count: seats.length });
}
