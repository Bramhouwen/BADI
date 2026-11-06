"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import { Camera, ImagePlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  bucket: "wall" | "recipes" | "avatars" | "prizes";
  /** Folder the current member may write to, e.g. `${challengeId}/${userId}` or `${userId}`. */
  pathPrefix: string;
  name?: string;
  initialUrl?: string | null;
  initialPath?: string | null;
  onChange?: (path: string | null) => void;
  aspect?: "square" | "portrait" | "wide";
  label?: string;
  round?: boolean;
}

function randomName() {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Picks a photo from camera or library, compresses it client-side and uploads to a private bucket. */
export function ImagePicker({ bucket, pathPrefix, name = "image_path", initialUrl, initialPath, onChange, aspect = "square", label = "Foto kiezen", round }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [path, setPath] = useState<string | null>(initialPath ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      if (!file.type.startsWith("image/")) throw new Error("Kies een afbeelding.");
      const compressed = await imageCompression(file, {
        maxSizeMB: bucket === "avatars" ? 0.3 : 0.9,
        maxWidthOrHeight: bucket === "avatars" ? 512 : 1600,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.84,
      });
      const objectPath = `${pathPrefix}/${Date.now().toString(36)}-${randomName()}.jpg`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from(bucket).upload(objectPath, compressed, {
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "3600",
      });
      if (upErr) throw upErr;
      const url = URL.createObjectURL(compressed);
      setPreview(url);
      setPath(objectPath);
      onChange?.(objectPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uploaden mislukt. Probeer het opnieuw.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function clear() {
    setPreview(null);
    setPath(null);
    onChange?.(null);
  }

  const ratio = aspect === "square" ? "aspect-square" : aspect === "portrait" ? "aspect-[4/5]" : "aspect-[16/10]";

  return (
    <div>
      <input type="hidden" name={name} value={path ?? ""} />
      <input ref={inputRef} id={id} type="file" accept="image/*" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
      {preview ? (
        <div className={cn("relative overflow-hidden border border-ink/10 bg-white/70", round ? "mx-auto h-28 w-28 rounded-full" : cn("rounded-[24px]", ratio))}>
          <Image src={preview} alt="Gekozen foto" fill className="object-cover" unoptimized />
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-ink/50 text-white"
            aria-label="Foto verwijderen"
          >
            <X className="h-4 w-4" />
          </button>
          {busy ? <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm">Uploaden...</div> : null}
        </div>
      ) : (
        <label
          htmlFor={id}
          className={cn(
            "glass flex cursor-pointer flex-col items-center justify-center gap-2 border-dashed text-text/80 transition hover:border-water-deep hover:text-text",
            round ? "mx-auto h-28 w-28 rounded-full" : cn("rounded-[24px]", ratio),
          )}
        >
          {busy ? (
            <span className="text-sm">Uploaden...</span>
          ) : (
            <>
              <span className="flex gap-3">
                <Camera className="h-6 w-6" />
                <ImagePlus className="h-6 w-6" />
              </span>
              {!round ? <span className="text-sm font-medium">{label}</span> : null}
            </>
          )}
        </label>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
