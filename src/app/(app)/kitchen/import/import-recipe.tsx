"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import imageCompression from "browser-image-compression";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, Hint, Input, Label, Textarea } from "@/components/ui/field";
import { ChipTabs } from "@/components/ui/page";
import { importRecipe } from "@/app/actions/recipe-import";
import { createRecipe } from "@/app/actions/recipes";
import { firstUrl, sourceLabel, type RecipeDraft } from "@/lib/recipe-import";
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
  const [image, setImage] = useState<{ file: File; preview: string } | null>(null);
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
      if (!image) return setError("Kies een screenshot.");
      fd.set("image", image.file);
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

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Kies een afbeelding.");
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.9, maxWidthOrHeight: 1800, useWebWorker: true, fileType: "image/jpeg", initialQuality: 0.85 });
      const jpg = new File([compressed], "screenshot.jpg", { type: "image/jpeg" });
      if (image) URL.revokeObjectURL(image.preview);
      setImage({ file: jpg, preview: URL.createObjectURL(jpg) });
    } catch {
      setError("Deze afbeelding kon niet worden geladen.");
    }
  }

  if (draft) {
    return (
      <div className="space-y-5">
        <div className="soft flex items-start gap-3 rounded-[18px] p-3.5">
          <p className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium text-text">{draft.source_url ? `Uit ${sourceLabel(draft.source_url)}` : mode === "image" ? "Uit je screenshot" : "Uit je tekst"}</span>
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
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          {image ? (
            <button type="button" onClick={() => fileRef.current?.click()} className="block w-full overflow-hidden rounded-[18px] border border-ink/10 bg-white/70">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.preview} alt="Gekozen screenshot" className="max-h-[360px] w-full object-contain" />
            </button>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="glass flex w-full flex-col items-center gap-2 rounded-[18px] px-4 py-8">
              <ImagePlus className="h-7 w-7 text-ink/70" strokeWidth={1.5} aria-hidden />
              <span className="text-[14px] font-medium text-text">Screenshot kiezen</span>
              <span className="text-[12px] text-muted">Van een recept in de AH-app, een website of een TikTok-video</span>
            </button>
          )}
        </div>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button type="button" size="lg" className="w-full" loading={pending} onClick={submit} disabled={pending || (mode === "link" ? !url.trim() : mode === "text" ? text.trim().length < 20 : !image)}>
        <span>{mode === "link" ? "Recept ophalen" : "Recept uitlezen"}</span>
      </Button>
    </div>
  );
}
