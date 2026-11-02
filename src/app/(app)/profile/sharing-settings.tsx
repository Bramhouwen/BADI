"use client";

import { useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { ErrorText } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { updateSharing } from "@/app/actions/sharing";
import { SHARING_OPTIONS, type SharingFlags } from "@/lib/squad-stats";
import { cn } from "@/lib/utils";

/** Switches for what squad members may see. Each change is saved immediately. */
export function SharingSettings({ initial }: { initial: SharingFlags }) {
  const [flags, setFlags] = useState<SharingFlags>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const toast = useToast();

  function save(next: SharingFlags) {
    setFlags(next);
    setError(null);
    start(async () => {
      const fd = new FormData();
      for (const o of SHARING_OPTIONS) if (next[o.key]) fd.set(o.key, "on");
      const r = await updateSharing(fd);
      if (!r.ok) {
        setError(r.error);
        setFlags(flags);
      } else toast("Zichtbaarheid opgeslagen", "success");
    });
  }

  return (
    <Card className="p-2">
      <form ref={form} className="divide-y divide-ink/[0.06]" aria-busy={pending}>
        {SHARING_OPTIONS.map((o) => {
          const on = flags[o.key];
          return (
            <label key={o.key} className="flex cursor-pointer items-center gap-3 px-2.5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-text">{o.label}</span>
                <span className="block text-[11.5px] leading-snug text-muted">{o.hint}</span>
              </span>
              <input
                type="checkbox"
                name={o.key}
                className="peer sr-only"
                checked={on}
                disabled={pending}
                onChange={(e) => save({ ...flags, [o.key]: e.target.checked })}
              />
              <span
                aria-hidden
                className={cn(
                  "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-sage/60",
                  on ? "bg-sage" : "bg-ink/15",
                )}
              >
                <span className={cn("absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[21px]" : "left-[3px]")} />
              </span>
            </label>
          );
        })}
      </form>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
