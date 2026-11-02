"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { GROUND, type Motion, type Prop } from "@/lib/exercise-motion/library";
import { blendFront, blendSide, cyclePosition, frontJoints, sideJoints, type FrontJoints, type Pt, type SideJoints } from "@/lib/exercise-motion/skeleton";

const INK = "#5f3529";
const PROP = "#9b8579";
const IRON = "#2b1813";

type Joints = SideJoints | FrontJoints;

function jointsAt(motion: Motion, from: number, to: number, t: number): Joints {
  if (motion.view === "side") {
    const pose = blendSide(motion.frames[from], motion.frames[to], t);
    const j = sideJoints(pose);
    if (!motion.anchor) return j;
    const p = motion.anchor.joint === "hip" ? j.hip : motion.anchor.joint === "hand" ? j.arms[0].hand : motion.anchor.joint === "toe" ? j.legs[0].toe : j.legs[0].ankle;
    return shiftSide(j, [motion.anchor.at[0] - p[0], motion.anchor.at[1] - p[1]]);
  }
  return frontJoints(blendFront(motion.frames[from], motion.frames[to], t));
}

const mv = (p: Pt, d: Pt): Pt => [p[0] + d[0], p[1] + d[1]];

function shiftSide(j: SideJoints, d: Pt): SideJoints {
  return {
    ...j,
    hip: mv(j.hip, d),
    shoulder: mv(j.shoulder, d),
    spineControl: mv(j.spineControl, d),
    neckEnd: mv(j.neckEnd, d),
    headCenter: mv(j.headCenter, d),
    arms: j.arms.map((a) => ({ elbow: mv(a.elbow, d), hand: mv(a.hand, d) })),
    legs: j.legs.map((l) => ({ knee: mv(l.knee, d), ankle: mv(l.ankle, d), toe: mv(l.toe, d) })),
  };
}

const line = (a: Pt, b: Pt) => `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
const chain = (...pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");

function Dumbbell({ at }: { at: Pt }) {
  return <rect x={at[0] - 8} y={at[1] - 3.5} width={16} height={7} rx={2.5} fill={IRON} />;
}

function HandProps({ props, hands, cableFrom }: { props: Prop[]; hands: Pt[]; cableFrom?: Pt }) {
  return (
    <>
      {props.map((p, i) => {
        if (p.type === "barbell") return <circle key={i} cx={hands[0][0]} cy={hands[0][1]} r={11} fill="none" stroke={IRON} strokeWidth={4} />;
        if (p.type === "dumbbells") return <g key={i}>{hands.map((h, k) => <Dumbbell key={k} at={h} />)}</g>;
        if (p.type === "cable" && cableFrom) return <path key={i} d={line(cableFrom, hands[0])} stroke={PROP} strokeWidth={1.5} />;
        if (p.type === "ball") {
          const c: Pt = hands.length > 1 ? [(hands[0][0] + hands[1][0]) / 2, (hands[0][1] + hands[1][1]) / 2 + 4] : hands[0];
          return <circle key={i} cx={c[0]} cy={c[1]} r={10} fill={IRON} />;
        }
        return null;
      })}
    </>
  );
}

function StaticProps({ props }: { props: Prop[] }) {
  return (
    <>
      {props.map((p, i) =>
        p.type === "line" ? <path key={i} d={line(p.from, p.to)} stroke={PROP} strokeWidth={p.width ?? 6} strokeLinecap="round" /> : p.type === "cable" ? <circle key={i} cx={p.from[0]} cy={p.from[1]} r={3} fill={PROP} /> : null,
      )}
    </>
  );
}

function SideFigure({ j, props }: { j: SideJoints; props: Prop[] }) {
  const near = { arm: j.arms[0], leg: j.legs[0] };
  const far = { arm: j.arms[1], leg: j.legs[1] };
  const cable = props.find((p): p is Extract<Prop, { type: "cable" }> => p.type === "cable");
  return (
    <>
      <g opacity={0.35} stroke={INK} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d={chain(j.hip, far.leg.knee, far.leg.ankle, far.leg.toe)} />
        <path d={chain(j.shoulder, far.arm.elbow, far.arm.hand)} />
      </g>
      <g stroke={INK} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d={`M${j.hip[0]} ${j.hip[1]}Q${j.spineControl[0]} ${j.spineControl[1]} ${j.shoulder[0]} ${j.shoulder[1]}`} strokeWidth={10} />
        <path d={line(j.shoulder, j.neckEnd)} strokeWidth={6} />
        <path d={chain(j.hip, near.leg.knee, near.leg.ankle, near.leg.toe)} strokeWidth={7} />
      </g>
      <circle cx={j.headCenter[0]} cy={j.headCenter[1]} r={9} fill={INK} />
      {props.some((p) => p.type === "pad") ? <circle cx={near.leg.ankle[0]} cy={near.leg.ankle[1]} r={5.5} fill="none" stroke={PROP} strokeWidth={3} /> : null}
      {props.some((p) => p.type === "plate") ? (
        <path d={line(mv(near.leg.ankle, [-9, -12]), mv(near.leg.ankle, [11, 14]))} stroke={PROP} strokeWidth={5} strokeLinecap="round" />
      ) : null}
      <path d={chain(j.shoulder, near.arm.elbow, near.arm.hand)} stroke={INK} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <HandProps props={props} hands={[near.arm.hand, far.arm.hand]} cableFrom={cable?.from} />
    </>
  );
}

function FrontFigure({ j, props }: { j: FrontJoints; props: Prop[] }) {
  const hip: Pt = [(j.pelvis[0][0] + j.pelvis[1][0]) / 2, (j.pelvis[0][1] + j.pelvis[1][1]) / 2];
  return (
    <>
      <g stroke={INK} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d={line(hip, j.neckBase)} strokeWidth={11} />
        <path d={line(j.shoulders[0], j.shoulders[1])} strokeWidth={7} />
        <path d={line(j.pelvis[0], j.pelvis[1])} strokeWidth={7} />
        {j.legs.map((l, i) => (
          <path key={i} d={chain(j.pelvis[i], l.knee, l.ankle)} strokeWidth={7} />
        ))}
        {j.arms.map((a, i) => (
          <path key={i} d={chain(j.shoulders[i], a.elbow, a.hand)} strokeWidth={7} />
        ))}
      </g>
      <circle cx={j.headCenter[0]} cy={j.headCenter[1]} r={9} fill={INK} />
      <HandProps props={props} hands={j.arms.map((a) => a.hand)} />
    </>
  );
}

function Scene({ motion, j }: { motion: Motion; j: Joints }) {
  const props = motion.props ?? [];
  return (
    <>
      <StaticProps props={props} />
      {j.kind === "side" ? <SideFigure j={j} props={props} /> : <FrontFigure j={j} props={props} />}
    </>
  );
}

/**
 * The exercise as a moving figure. Animates only while on screen; with
 * "reduce motion" on, it shows the start position with the end position
 * faintly behind it.
 */
export function ExerciseFigure({ motion, animate = true, className, label, frame }: { motion: Motion; animate?: boolean; className?: string; label: string; /** Show exactly this keyframe, without ghost. */ frame?: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(false);
  const [now, setNow] = useState(0);
  const live = frame === undefined && animate && !reduce && motion.frames.length > 1;

  useEffect(() => {
    const el = ref.current;
    if (!el || !live) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, [live]);

  useEffect(() => {
    if (!live || !visible) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      setNow(t - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, visible]);

  const last = motion.frames.length - 1;
  const pos = live ? cyclePosition(motion.frames.length, now, motion.beatMs ?? 1000) : { from: frame ?? 0, to: frame ?? 0, t: 0 };
  const j = jointsAt(motion, pos.from, pos.to, pos.t);
  const ghost = !live && frame === undefined && last > 0 ? jointsAt(motion, last, last, 0) : null;

  return (
    <svg ref={ref} viewBox="0 0 200 190" className={className} role="img" aria-label={label}>
      <line x1={8} x2={192} y1={GROUND + 1} y2={GROUND + 1} stroke={PROP} strokeOpacity={0.45} strokeWidth={1.5} />
      {ghost ? (
        <g opacity={0.22}>
          <Scene motion={motion} j={ghost} />
        </g>
      ) : null}
      <Scene motion={motion} j={j} />
    </svg>
  );
}
