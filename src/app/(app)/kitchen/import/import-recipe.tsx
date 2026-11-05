"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import imageCompression from "browser-image-compression";
import { ImagePlus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, Hint, Input, Label, Textarea } from "@/components/ui/field";
import { ChipTabs } from "@/components/ui/page";
import { importRecipe } from "@/app/actions/recipe-import";
import { createRecipe } from "@/app/actions/recipes";
import { MAX_IMAGES, firstUrl, sourceLabel, type RecipeDraft } from "@/lib/recipe-import";
import { RecipeForm } from "../recipe-form";

type Mode = "link" | "text" | "image";

/**
 * Link, pasted text or screenshot in; a filled-in recipe form out. The member
 * checks the form and shares the recipe, nothing is saved before that.
 */
export function ImportRecipe({ pathPrefix, shared }: { pathPrefix: string; shared: string }) {
  const sharedUrl = shared ? firstUrl(shared) : null;
  const [mode, setMode] = useState<Mode>(shared && !sharedUrl ? "text" : "link");
  const [url, setUrl] = useState(sharedUrl ?? "");
  const [text, setText] = useState(shared && !sharedUrl ? shared : "");
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const autoRan = useRef(false);

  function run(fd: FormData) {
    setError(null);
    start(async () => {
      const r = await importRecipe(fd);
      if (r.ok && r.data) setDraft(r.data);
      else if (!r.ok) setError(r.error);
    });
  }

  function submit() {
    const fd = new FormData();
    fd.set("mode", mode);
    if (mode === "link") fd.set("url", url.trim());
    if (mode === "text") fd.set("text", text);
    if (mode === "image") {
      if (images.length === 0) return setError("Kies een screenshot.");
      for (const img of images) fd.append("image", img.file);
    }
    run(fd);
  }

  // Shared to BADI from another app (Android share menu): start right away.
  useEffect(() => {
    if (!shared || autoRan.current) return;
    autoRan.current = true;
    const fd = new FormData();
    if (sharedUrl) {
      fd.set("mode", "link");
      fd.set("url", sharedUrl);
    } else {
      fd.set("mode", "text");
      fd.set("text", shared);
    }
    run(fd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Adds the chosen screenshots, compressed, in the order picked; at most MAX_IMAGES in total. */
  async function pick(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    setError(null);
    if (files.some((f) => !f.type.startsWith("image/"))) return setError("Kies alleen afbeeldingen.");
    const room = MAX_IMAGES - images.length;
    if (files.length > room) setError(`Maximaal ${MAX_IMAGES} screenshots per recept. De eerste ${Math.max(0, room)} zijn toegevoegd.`);
    setBusy(true);
    try {
      const added: { file: File; preview: string }[] = [];
      for (const file of files.slice(0, Math.max(0, room))) {
        // Small enough that four fit in one upload, sharp enough to read the text.
        const compressed = await imageCompression(file, { maxSizeMB: 0.7, maxWidthOrHeight: 1800, useWebWorker: true, fileType: "image/jpeg", initialQuality: 0.82 });
        const jpg = new File([compressed], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
        added.push({ file: jpg, preview: URL.createObjectURL(jpg) });
      }
      setImages((l) => [...l, ...added]);
    } catch {
      setError("Een afbeelding kon niet worden geladen.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeImage(i: number) {
    setImages((l) => {
      URL.revokeObjectURL(l[i].preview);
      return l.filter((_, k) => k !== i);
    });
  }

  if (draft) {
    return (
      <div className="space-y-5">
        <div className="soft flex items-start gap-3 rounded-[18px] p-3.5">
          <p className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium text-text">{draft.source_url ? `Uit ${sourceLabel(draft.source_url)}` : mode === "image" ? (images.length > 1 ? `Uit je ${images.length} screenshots` : "Uit je screenshot") : "Uit je tekst"}</span>
            <span className="block text-[12.5px] text-muted">Controleer het recept voordat je het deelt.</span>
          </p>
          <Button type="button" size="sm" variant="secondary" onClick={() => setDraft(null)}>
            Andere bron
          </Button>
        </div>
        <RecipeForm action={createRecipe} pathPrefix={pathPrefix} recipe={draft} submitLabel="Recept delen" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ChipTabs
        label="Bron"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
        options={[
          { key: "link", label: "Link" },
          { key: "text", label: "Tekst" },
          { key: "image", label: "Screenshot" },
        ]}
      />

      {mode === "link" ? (
        <div>
          <Label htmlFor="import-url">Link naar het recept</Label>
          <Input id="import-url" type="url" inputMode="url" autoComplete="off" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          <Hint>Werkt met de meeste receptsites. Bij TikTok alleen als het recept in de beschrijving staat.</Hint>
        </div>
      ) : null}

      {mode === "text" ? (
        <div>
          <Label htmlFor="import-text">Tekst van het recept</Label>
          <Textarea id="import-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Plak hier de ingrediënten en bereiding, bijvoorbeeld uit de AH-app of een TikTok-beschrijving." maxLength={8000} className="min-h-[180px]" />
        </div>
      ) : null}

      {mode === "image" ? (
        <div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => pick(e.target.files)} />
          {images.length > 0 ? (
            <>
              <ul className="grid grid-cols-3 gap-2">
                {images.map((img, i) => (
                  <li key={img.preview} className="relative aspect-[3/4] overflow-hidden rounded-[14px] border border-ink/10 bg-white/70">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.preview} alt={`Screenshot ${i + 1}`} className="h-full w-full object-cover object-top" />
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 text-[10.5px] font-semibold tabular-nums text-ink shadow-sm">{i + 1}</span>
                    <button type="button" onClick={() => removeImage(i)} aria-label={`Screenshot ${i + 1} weghalen`} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm">
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </li>
                ))}
                {images.length < MAX_IMAGES ? (
                  <li>
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-ink/20 text-muted">
                      <Plus className="h-5 w-5" strokeWidth={1.7} />
                      <span className="text-[11.5px] font-medium">Toevoegen</span>
                    </button>
                  </li>
                ) : null}
              </ul>
              <p className="mt-2 text-[11.5px] text-muted">
                {images.length} van {MAX_IMAGES} screenshots. Ze worden samen als één recept gelezen, in deze volgorde.
              </p>
            </>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="glass flex w-full flex-col items-center gap-2 rounded-[18px] px-4 py-8">
              <ImagePlus className="h-7 w-7 text-ink/70" strokeWidth={1.5} aria-hidden />
              <span className="text-[14px] font-medium text-text">{busy ? "Bezig met laden…" : "Screenshots kiezen"}</span>
              <span className="text-[12px] text-muted">Tot {MAX_IMAGES} tegelijk, bijvoorbeeld ingrediënten en bereiding</span>
            </button>
          )}
        </div>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button type="button" size="lg" className="w-full" loading={pending} onClick={submit} disabled={pending || (mode === "link" ? !url.trim() : mode === "text" ? text.trim().length < 20 : images.length === 0 || busy)}>
        <span>{mode === "link" ? "Recept ophalen" : "Recept uitlezen"}</span>
      </Button>
    </div>
  );
}
