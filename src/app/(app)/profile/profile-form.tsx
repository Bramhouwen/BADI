"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorText, Input, Label } from "@/components/ui/field";
import { ImagePicker } from "@/components/app/image-picker";
import { useToast } from "@/components/ui/toast";
import { updateProfile } from "@/app/actions/profile";

export function ProfileForm({ displayName, avatarUrl, avatarPath, userId }: { displayName: string; avatarUrl: string | null; avatarPath: string | null; userId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError(null);
          start(async () => {
            const r = await updateProfile(fd);
            if (!r.ok) setError(r.error);
            else toast("Profiel opgeslagen", "success");
          });
        }}
      >
        <ImagePicker bucket="avatars" pathPrefix={userId} name="avatar_path" initialUrl={avatarUrl} initialPath={avatarPath} round />
        <div>
          <Label htmlFor="display_name">Naam</Label>
          <Input id="display_name" name="display_name" defaultValue={displayName} maxLength={40} required />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="secondary" className="w-full" loading={pending}>
          Opslaan
        </Button>
      </form>
    </Card>
  );
}
