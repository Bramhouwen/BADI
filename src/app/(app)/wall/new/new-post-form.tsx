"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ErrorText, Label, Textarea } from "@/components/ui/field";
import { ImagePicker } from "@/components/app/image-picker";
import { createPost } from "@/app/actions/wall";

export function NewPostForm({ pathPrefix }: { pathPrefix: string }) {
  const [error, setError] = useState<string | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-5"
      action={(fd) => {
        setError(null);
        start(async () => {
          const r = await createPost(fd);
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <ImagePicker bucket="wall" pathPrefix={pathPrefix} aspect="portrait" label="Maak of kies een foto" onChange={(p) => setHasImage(Boolean(p))} />
      <div>
        <Label htmlFor="caption">Bijschrift (optioneel)</Label>
        <Textarea id="caption" name="caption" maxLength={500} placeholder="Koude ochtend, warme benen. 🔥" className="min-h-[72px]" />
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!hasImage}>
        Plaatsen op de Wall
      </Button>
    </form>
  );
}
