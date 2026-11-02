/**
 * A small 2D figure for exercise demos. Pure geometry: poses in, points out.
 *
 * Angles are in degrees, absolute (not relative to the parent limb), measured
 * from straight down: 0 = down, 90 = towards the front (to the right on
 * screen), 180 = up, 270 = towards the back. The figure faces right.
 */

export type Pt = [number, number];
export type Limb = [number, number]; // [upper, lower] absolute angles

export interface SidePose {
  /** Hip joint before anchoring. */
  hip: Pt;
  /** Direction from hip to shoulders (180 = upright). */
  torso: number;
  /** Direction of the neck and head; defaults to the torso direction. */
  head?: number;
  /** Bend of the spine, -1 (rounded back) to 1 (hollow back). */
  spine?: number;
  /** [near, far] arm: [upper arm, forearm]. */
  arms: [Limb, Limb];
  /** [near, far] leg: [thigh, shin]. */
  legs: [Limb, Limb];
  /** [near, far] foot angle; defaults to the shin angle + 90 (flat, toes forward). */
  feet?: [number, number];
}

export interface FrontPose {
  hip: Pt;
  /** Sideways lean of the torso: 0 upright, positive leans to the figure's right (screen left). */
  lean?: number;
  /** [screen-left, screen-right] arm: [upper, lower], 0 = down, 90 = straight out sideways, 180 = up; negative crosses the midline. */
  arms: [Limb, Limb];
  /** [screen-left, screen-right] leg: [thigh, shin], outward like the arms. */
  legs: [Limb, Limb];
}

export const BONES = { torso: 50, neck: 7, head: 9, upperArm: 25, forearm: 24, thigh: 30, shin: 30, foot: 8 } as const;

const rad = (d: number) => (d * Math.PI) / 180;

/** Unit vector for an absolute angle (SVG coordinates, y down). */
export function dir(angle: number): Pt {
  return [Math.sin(rad(angle)), Math.cos(rad(angle))];
}

function add(p: Pt, d: Pt, len: number): Pt {
  return [p[0] + d[0] * len, p[1] + d[1] * len];
}

export interface SideJoints {
  kind: "side";
  hip: Pt;
  shoulder: Pt;
  spineControl: Pt;
  neckEnd: Pt;
  headCenter: Pt;
  arms: { elbow: Pt; hand: Pt }[];
  legs: { knee: Pt; ankle: Pt; toe: Pt }[];
}

export interface FrontJoints {
  kind: "front";
  pelvis: [Pt, Pt];
  shoulders: [Pt, Pt];
  neckBase: Pt;
  headCenter: Pt;
  arms: { elbow: Pt; hand: Pt }[];
  legs: { knee: Pt; ankle: Pt }[];
}

export function sideJoints(p: SidePose): SideJoints {
  const t = dir(p.torso);
  const shoulder = add(p.hip, t, BONES.torso);
  // Spine bend: push the midpoint sideways (perpendicular to the torso).
  const mid: Pt = [(p.hip[0] + shoulder[0]) / 2, (p.hip[1] + shoulder[1]) / 2];
  const perp: Pt = [t[1], -t[0]];
  // perp points to the back side of the body; a rounded back (spine < 0) bulges that way.
  const spineControl = add(mid, perp, -(p.spine ?? 0) * 14);
  const h = dir(p.head ?? p.torso);
  const neckEnd = add(shoulder, h, BONES.neck);
  const headCenter = add(shoulder, h, BONES.neck + BONES.head);
  const arms = p.arms.map(([u, l]) => {
    const elbow = add(shoulder, dir(u), BONES.upperArm);
    return { elbow, hand: add(elbow, dir(l), BONES.forearm) };
  });
  const legs = p.legs.map(([u, l], i) => {
    const knee = add(p.hip, dir(u), BONES.thigh);
    const ankle = add(knee, dir(l), BONES.shin);
    return { knee, ankle, toe: add(ankle, dir(p.feet?.[i] ?? l + 90), BONES.foot) };
  });
  return { kind: "side", hip: p.hip, shoulder, spineControl, neckEnd, headCenter, arms, legs };
}

const SHOULDER_HALF = 15;
const PELVIS_HALF = 9;

export function frontJoints(p: FrontPose): FrontJoints {
  const lean = p.lean ?? 0;
  const up = dir(180 + lean);
  const neckBase = add(p.hip, up, BONES.torso);
  const side: Pt = [up[1] * -1, up[0]]; // perpendicular, pointing to screen right when upright
  const shoulders: [Pt, Pt] = [add(neckBase, side, -SHOULDER_HALF), add(neckBase, side, SHOULDER_HALF)];
  const pelvis: [Pt, Pt] = [add(p.hip, side, -PELVIS_HALF), add(p.hip, side, PELVIS_HALF)];
  const headCenter = add(neckBase, up, BONES.neck + BONES.head);
  // Outward means towards the screen edge on that side.
  const out = (angle: number, s: -1 | 1): Pt => [s * Math.sin(rad(angle)), Math.cos(rad(angle))];
  const arms = p.arms.map(([u, l], i) => {
    const s = i === 0 ? -1 : 1;
    const elbow = add(shoulders[i], out(u, s), BONES.upperArm);
    return { elbow, hand: add(elbow, out(l, s), BONES.forearm) };
  });
  const legs = p.legs.map(([u, l], i) => {
    const s = i === 0 ? -1 : 1;
    const knee = add(pelvis[i], out(u, s), BONES.thigh);
    return { knee, ankle: add(knee, out(l, s), BONES.shin) };
  });
  return { kind: "front", pelvis, shoulders, neckBase, headCenter, arms, legs };
}

/** Linear blend of two angles along the shortest way round. */
export function lerpAngle(a: number, b: number, t: number): number {
  const diff = ((((b - a) % 360) + 540) % 360) - 180;
  return a + diff * t;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const lerpLimb = (a: Limb, b: Limb, t: number): Limb => [lerpAngle(a[0], b[0], t), lerpAngle(a[1], b[1], t)];

export function blendSide(a: SidePose, b: SidePose, t: number): SidePose {
  return {
    hip: lerpPt(a.hip, b.hip, t),
    torso: lerpAngle(a.torso, b.torso, t),
    head: lerpAngle(a.head ?? a.torso, b.head ?? b.torso, t),
    spine: lerp(a.spine ?? 0, b.spine ?? 0, t),
    arms: [lerpLimb(a.arms[0], b.arms[0], t), lerpLimb(a.arms[1], b.arms[1], t)],
    legs: [lerpLimb(a.legs[0], b.legs[0], t), lerpLimb(a.legs[1], b.legs[1], t)],
    feet: a.feet || b.feet ? [lerpAngle(a.feet?.[0] ?? a.legs[0][1] + 90, b.feet?.[0] ?? b.legs[0][1] + 90, t), lerpAngle(a.feet?.[1] ?? a.legs[1][1] + 90, b.feet?.[1] ?? b.legs[1][1] + 90, t)] : undefined,
  };
}

export function blendFront(a: FrontPose, b: FrontPose, t: number): FrontPose {
  return {
    hip: lerpPt(a.hip, b.hip, t),
    lean: lerp(a.lean ?? 0, b.lean ?? 0, t),
    arms: [lerpLimb(a.arms[0], b.arms[0], t), lerpLimb(a.arms[1], b.arms[1], t)],
    legs: [lerpLimb(a.legs[0], b.legs[0], t), lerpLimb(a.legs[1], b.legs[1], t)],
  };
}

/** Smooth in and out. */
export function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Position in a looping keyframe cycle: goes through the frames and back
 * (ping-pong) with a short hold on each frame. Returns the two frames and
 * the eased mix between them.
 */
export function cyclePosition(frames: number, elapsedMs: number, beatMs: number, hold = 0.25): { from: number; to: number; t: number } {
  if (frames <= 1) return { from: 0, to: 0, t: 0 };
  const path = [...Array(frames).keys(), ...Array.from({ length: frames - 2 }, (_, i) => frames - 2 - i)];
  const step = Math.floor(elapsedMs / beatMs) % path.length;
  const raw = (elapsedMs % beatMs) / beatMs;
  const moving = Math.max(0, (raw - hold) / (1 - hold));
  return { from: path[step], to: path[(step + 1) % path.length], t: ease(moving) };
}
