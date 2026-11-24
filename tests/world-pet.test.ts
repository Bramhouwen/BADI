import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { DOG, PETS, PET_SPEED, newPet, petFrame, restPose, stepPet, type PetPose } from "@/lib/world/engine/pet";

const fixed = (v: number) => () => v;

describe("pet", () => {
  it("lives in Daphne's room and has every frame", () => {
    expect(PETS.daphne).toBe(DOG);
    for (const [pose, n] of Object.entries(DOG.frames) as [PetPose, number][])
      for (let i = 1; i <= n; i++) expect(fs.existsSync(`public/wereld/dieren/${DOG.key}/${pose}-${String(i).padStart(2, "0")}.png`), `${pose} ${i}`).toBe(true);
  });

  it("rests first, then walks the route it gets and rests again where it arrives", () => {
    const pet = newPet([0, 0], 0, fixed(0.5));
    expect(pet.pose).toBe("slapen");
    stepPet(pet, 0.016, 100, () => [[PET_SPEED, 0]]);
    expect(pet.pose).toBe("slapen");
    stepPet(pet, 0.016, pet.until + 1, () => [[PET_SPEED, 0]]);
    expect(pet.pose).toBe("lopen");
    expect(pet.path).toHaveLength(1);
    stepPet(pet, 0.5, pet.until + 500, () => null);
    expect(pet.feet[0]).toBeCloseTo(PET_SPEED / 2);
    expect(pet.facing).toBe("right");
    stepPet(pet, 0.6, pet.until + 1100, () => null, fixed(0.5));
    expect(pet.feet).toEqual([PET_SPEED, 0]);
    expect(pet.pose).toBe("zitten");
  });

  it("waits a bit when there is nowhere to go", () => {
    const pet = newPet([5, 5], 0, fixed(0));
    const at = pet.until + 1;
    stepPet(pet, 0.016, at, () => null);
    expect(pet.pose).toBe("slapen");
    expect(pet.until).toBe(at + 3000);
  });

  it("picks every rest pose, sleeping longest", () => {
    expect(restPose(fixed(0.1)).pose).toBe("staan");
    expect(restPose(fixed(0.5)).pose).toBe("zitten");
    expect(restPose(fixed(0.7)).pose).toBe("liggen");
    expect(restPose(fixed(0.9)).pose).toBe("slapen");
    expect(restPose(fixed(0.9)).ms).toBeGreaterThan(restPose(fixed(0.1)).ms);
  });

  it("loops the walking frames", () => {
    const pet = { ...newPet([0, 0], 0), pose: "lopen" as const, since: 0 };
    const seen = new Set([0, 150, 300, 450, 600].map((t) => petFrame(DOG, pet, t)));
    expect([...seen].every((f) => f >= 1 && f <= DOG.frames.lopen)).toBe(true);
    expect(seen.size).toBeGreaterThan(1);
  });
});
