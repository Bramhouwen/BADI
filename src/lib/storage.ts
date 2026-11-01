import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Bucket = "wall" | "recipes" | "avatars";

const SIGNED_URL_TTL = 60 * 60; // one hour

/** Signed URLs for private objects, keyed by path. Missing or unauthorized paths are omitted. */
export async function signedUrlMap(bucket: Bucket, paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(unique, SIGNED_URL_TTL);
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  }
  return map;
}

export async function signedUrl(bucket: Bucket, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const map = await signedUrlMap(bucket, [path]);
  return map.get(path) ?? null;
}

export { isOwnedMediaPath, isOwnedAvatarPath } from "./media-paths";
