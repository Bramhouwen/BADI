import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { WORLD_SCENES, WORLD_SPRITES, newWorldProfile, worldSpriteFor, type SpriteManifest } from "@/lib/world/types";

const PUBLIC = path.join(__dirname, "..", "public", "wereld");
const NEEDED = ["staan", "lopen", "zitten", "slapen", "zwaaien", "juichen", "blij", "sprongsquat"];

describe("world profile", () => {
  it("picks the character from the first name", () => {
    expect(worldSpriteFor("Anne de Vries")).toBe("anne");
    expect(worldSpriteFor("bram")).toBe("bram");
    expect(worldSpriteFor("Sam")).toBeNull();
  });

  it("starts outside without a position", () => {
    expect(newWorldProfile("u1", "c1", "Irene")).toEqual({ user_id: "u1", challenge_id: "c1", sprite: "irene", scene: "buiten", x: null, y: null });
  });
});

describe("world assets", () => {
  it("has a background for every scene", () => {
    for (const s of WORLD_SCENES) expect(fs.existsSync(path.join(PUBLIC, "scenes", `${s}.webp`))).toBe(true);
  });

  for (const key of WORLD_SPRITES) {
    it(`${key}: manifest lists every animation, every frame exists, anchors sit under the feet`, () => {
      const dir = path.join(PUBLIC, "poppetjes", key);
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) as SpriteManifest;
      expect(manifest.frameWidth).toBe(320);
      expect(manifest.frameHeight).toBe(272);
      for (const anim of NEEDED) {
        const a = manifest.animations[anim];
        expect(a, anim).toBeTruthy();
        expect(a.fps).toBeGreaterThan(0);
        for (const f of a.frames) expect(fs.existsSync(path.join(dir, f)), f).toBe(true);
        expect(a.anchor.y).toBeGreaterThan(manifest.frameHeight * 0.6);
        expect(a.anchor.y).toBeLessThanOrEqual(manifest.frameHeight);
        expect(Math.abs(a.anchor.x - manifest.frameWidth / 2)).toBeLessThan(80);
      }
    });
  }
});
