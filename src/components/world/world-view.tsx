"use client";

import { useEffect, useState } from "react";
import { SCENES, FIRST_SCENE } from "@/lib/world/scenes";
import type { Door } from "@/lib/world/engine/scene";
import { WorldCanvas } from "./world-canvas";

const FADE_MS = 220;

/**
 * BADI Wereld: the scene you are in, and walking through doors to the
 * others. A door fades the picture out, the next scene starts at the door
 * you come out of and fades in once it is drawn. All backgrounds are loaded
 * up front, so a door opens right away.
 */
export function WorldView({
  me,
  startScene,
  startX = null,
  startY = null,
  debug = false,
  overlay = false,
  edit = false,
}: {
  me: { id: string; name: string; character: string | null };
  startScene: string;
  startX?: number | null;
  startY?: number | null;
  debug?: boolean;
  overlay?: boolean;
  edit?: boolean;
}) {
  const [here, setHere] = useState(() => ({ scene: SCENES[startScene] ? startScene : FIRST_SCENE, arrive: null as string | null, n: 0 }));
  const [dim, setDim] = useState(false);

  useEffect(() => {
    for (const s of Object.values(SCENES)) {
      const img = new Image();
      img.decoding = "async";
      img.src = s.background;
    }
  }, []);

  const onDoor = (door: Door) => {
    const to = door.to;
    if (!to || !SCENES[to]) return;
    setDim(true);
    setTimeout(() => setHere((h) => ({ scene: to, arrive: door.arrive ?? null, n: h.n + 1 })), FADE_MS);
  };

  const scene = SCENES[here.scene];
  const first = here.n === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">BADI Wereld · {scene.name}</p>
          <h1 className="truncate font-display text-[28px] leading-tight text-text">{me.name}</h1>
        </div>
        <p className="shrink-0 pb-1 text-[12.5px] text-muted">{edit ? "Zitplekken plaatsen" : "Tik om te lopen"}</p>
      </div>
      <div style={{ opacity: dim ? 0 : 1, transition: `opacity ${FADE_MS}ms ease` }}>
        <WorldCanvas
          key={here.n}
          scene={scene}
          me={me}
          startX={first ? startX : null}
          startY={first ? startY : null}
          arriveAt={here.arrive}
          debug={debug}
          overlay={overlay}
          edit={edit}
          onDoor={onDoor}
          onReady={() => setDim(false)}
        />
      </div>
    </div>
  );
}
