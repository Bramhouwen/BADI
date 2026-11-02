import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isStaticMediaPath, staticMediaUrl } from "./media-paths";

export type Bucket = "wall" | "recipes" | "avatars" | "chat";

const SIGNED_URL_TTL = 60 * 60; // one hour

/** One storage round trip per distinct (bucket, paths) within a request. */
const signBatch = cache(async (bucket: Bucket, key: string): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  const paths = key ? key.split("\n") : [];
  if (paths.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_TTL);
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  }
  return map;
});

/** Signed URLs for private objects, keyed by path. Missing or unauthorized paths are omitted. */
export async function signedUrlMap(bucket: Bucket, paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))].filter((p) => {
    if (isStaticMediaPath(p)) {
      map.set(p, staticMediaUrl(p));
      return false;
    }
    return true;
  });
  if (unique.length === 0) return map;
  const signed = await signBatch(bucket, [...unique].sort().join("\n"));
  for (const [path, url] of signed) map.set(path, url);
  return map;
}

export async function signedUrl(bucket: Bucket, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const map = await signedUrlMap(bucket, [path]);
  return map.get(path) ?? null;
}

export { isOwnedMediaPath, isOwnedAvatarPath, isStaticMediaPath } from "./media-paths";
