/**
 * Characters from public/wereld/poppetjes/<naam>: the manifest says which
 * frames, how fast and where the feet are. All frames are packed into one
 * atlas canvas when loading, so drawing is a single copy per frame.
 */
import type { SpriteManifest } from "../types";

export interface LoadedCharacter {
  key: string;
  manifest: SpriteManifest;
  atlas: HTMLCanvasElement;
  /** Atlas position of every frame per animation. */
  cells: Record<string, { sx: number; sy: number }[]>;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Kon ${src} niet laden`));
    img.src = src;
  });
}

const loaded = new Map<string, Promise<LoadedCharacter>>();

/** A character, loaded once per page: walking through a door does not load it again. */
export function loadCharacter(key: string): Promise<LoadedCharacter> {
  let p = loaded.get(key);
  if (!p) {
    p = buildCharacter(key);
    p.catch(() => loaded.delete(key));
    loaded.set(key, p);
  }
  return p;
}

async function buildCharacter(key: string): Promise<LoadedCharacter> {
  const base = `/wereld/poppetjes/${key}/`;
  const manifest = (await fetch(base + "manifest.json").then((r) => r.json())) as SpriteManifest;
  const files = [...new Set(Object.values(manifest.animations).flatMap((a) => a.frames))];
  const images = await Promise.all(files.map((f) => loadImage(base + f)));
  const cols = Math.ceil(Math.sqrt(files.length));
  const rows = Math.ceil(files.length / cols);
  const atlas = document.createElement("canvas");
  atlas.width = cols * manifest.frameWidth;
  atlas.height = rows * manifest.frameHeight;
  const ctx = atlas.getContext("2d")!;
  const at = new Map<string, { sx: number; sy: number }>();
  files.forEach((f, i) => {
    const sx = (i % cols) * manifest.frameWidth;
    const sy = Math.floor(i / cols) * manifest.frameHeight;
    ctx.drawImage(images[i], sx, sy);
    at.set(f, { sx, sy });
  });
  const cells: LoadedCharacter["cells"] = {};
  for (const [anim, a] of Object.entries(manifest.animations)) cells[anim] = a.frames.map((f) => at.get(f)!);
  return { key, manifest, atlas, cells };
}

/** Index of the frame to show `ms` after an animation started. */
export function frameIndex(fps: number, count: number, ms: number): number {
  if (count <= 1) return 0;
  // Input events and frames use slightly different clocks: never go below frame 0.
  return Math.floor((Math.max(0, ms) / 1000) * fps) % count;
}
