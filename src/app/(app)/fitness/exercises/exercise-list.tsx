"use client";

import { useState } from "react";
import { ExerciseDemoSheet, ExerciseThumb, hasDemo } from "@/components/fitness/exercise-demo";

export interface ExerciseGroup {
  key: string;
  label: string;
  items: { id: string; name: string }[];
}

/** All exercises per muscle group; tap one to see the demo. */
export function ExerciseList({ groups }: { groups: ExerciseGroup[] }) {
  const [open, setOpen] = useState<{ name: string; group: string } | null>(null);
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label}>
          <h2 className="mb-2 px-0.5 font-display text-[19px]">{g.label}</h2>
          <ul className="grid grid-cols-2 gap-2.5">
            {g.items.map((e) => {
              const animated = hasDemo(e.name);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={!animated}
                    onClick={() => setOpen({ name: e.name, group: g.label })}
                    className="glass flex w-full flex-col items-stretch rounded-[18px] p-2 text-left disabled:opacity-60"
                  >
                    <span className="block overflow-hidden rounded-[13px] bg-[#fbf3ec]">
                      {animated ? <ExerciseThumb name={e.name} className="block aspect-square w-full" /> : <span className="block aspect-square" />}
                    </span>
                    <span className="mt-1.5 block truncate px-1">
                      <span className="text-[13px] font-medium text-text">{e.name}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <ExerciseDemoSheet name={open?.name ?? ""} subtitle={open?.group} open={Boolean(open)} onClose={() => setOpen(null)} />
    </div>
  );
}
