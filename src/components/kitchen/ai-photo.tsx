"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { generateMissingPhotos, generateRecipePhoto } from "@/app/actions/recipe-images";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** Small label on a generated photo. */
export function AiBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 backdrop-blur", className)}>
      <Sparkles className="h-3 w-3 text-white" strokeWidth={2} aria-hidden />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-white">AI-foto</span>
    </span>
  );
}

/** Make or remake the AI photo of one recipe. */
export function AiPhotoButton({ recipeId, hasAiPhoto }: { recipeId: string; hasAiPhoto: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await generateRecipePhoto(recipeId);
          if (!r.ok) toast(r.error, "error");
          else router.refresh();
        })
      }
      className="flex h-10 items-center gap-1.5 rounded-full bg-white px-4 shadow-sm ring-1 ring-ink/[0.06] disabled:opacity-70"
    >
      <Sparkles className={cn("h-4 w-4 text-ink", pending && "animate-pulse")} strokeWidth={1.8} />
      <span className="text-[13px] font-medium text-ink">{pending ? "Foto wordt gemaakt…" : hasAiPhoto ? "Nieuwe AI-foto" : "Maak AI-foto"}</span>
    </button>
  );
}

/** Right after saving a recipe without a photo: refresh until the AI photo is there (about 10 seconds). */
export function PhotoPending() {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (tries >= 10) return;
    const t = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, 4000);
    return () => clearTimeout(t);
  }, [tries, router]);
  if (tries >= 10) return null;
  return (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/30 backdrop-blur-[1px]">
      <Sparkles className="h-7 w-7 animate-pulse text-ink/70" strokeWidth={1.5} aria-hidden />
      <span className="text-[13px] font-medium text-ink/80">AI-foto wordt gemaakt…</span>
    </span>
  );
}

/** Kitchen: give recipes without a photo an AI photo, six at a time. */
export function MissingPhotos({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  if (count === 0) return null;
  return (
    <div className="glass mb-4 flex items-center gap-3 rounded-[18px] px-3.5 py-2.5">
      <Sparkles className="h-4 w-4 shrink-0 text-ink/70" strokeWidth={1.8} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="text-[12.5px] text-muted">
          {count} {count === 1 ? "recept" : "recepten"} zonder foto
        </span>
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await generateMissingPhotos();
            if (!r.ok) toast(r.error, "error");
            else {
              toast(`${r.data!.made} AI-${r.data!.made === 1 ? "foto" : "foto's"} gemaakt`, "success");
              router.refresh();
            }
          })
        }
        className="shrink-0 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-ink/[0.06] disabled:opacity-70"
      >
        <span className="text-[12px] font-medium text-ink">{pending ? "Bezig…" : "Maak AI-foto's"}</span>
      </button>
    </div>
  );
}
