"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SCENES, FIRST_SCENE } from "@/lib/world/scenes";
import type { Door } from "@/lib/world/engine/scene";
import { WorldCanvas } from "./world-canvas";

const FADE_MS = 220;

/**
 * BADI Wereld, over the whole screen like a game: the scene you are in, a
 * back button and the name of the room on top, and walking through doors to
 * the others. A door fades the picture out, the next scene starts at the door
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
  notice = null,
}: {
  me: { id: string; name: string; character: string | null };
  startScene: string;
  startX?: number | null;
  startY?: number | null;
  debug?: boolean;
  overlay?: boolean;
  edit?: boolean;
  /** A line shown under the room name, for example when positions are not saved. */
  notice?: string | null;
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
    <div className="fixed inset-0 z-40 overflow-hidden overscroll-none bg-[#f6ece4]">
      <div className="absolute inset-0" style={{ opacity: dim ? 0 : 1, transition: `opacity ${FADE_MS}ms ease` }}>
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
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 px-3" style={{ paddingTop: "calc(var(--sat) + 12px)" }}>
        <Link
          href="/"
          aria-label="Terug naar de app"
          className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/90 text-ink shadow-md ring-1 ring-ink/[0.06] backdrop-blur"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0 rounded-full bg-white/90 px-4 py-2 shadow-md ring-1 ring-ink/[0.06] backdrop-blur">
          <p className="truncate text-[14px] font-semibold leading-tight text-text">{scene.name}</p>
          {edit || notice ? <p className="truncate text-[11.5px] leading-tight text-muted">{edit ? "Zitplekken plaatsen" : notice}</p> : null}
        </div>
      </div>
    </div>
  );
}
