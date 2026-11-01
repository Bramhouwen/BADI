/** Pure validators for storage object paths (shared by server code and tests). */

/** Bundled images under /public, used by seeded recipes: "static:/recipes/x.jpg". */
export function isStaticMediaPath(path: string): boolean {
  return /^static:\/[A-Za-z0-9/_.-]+\.(jpg|jpeg|png|webp)$/.test(path) && !path.includes("..");
}

export function staticMediaUrl(path: string): string {
  return path.slice("static:".length);
}

export function isOwnedMediaPath(path: string, challengeId: string, userId: string): boolean {
  if (isStaticMediaPath(path)) return true;
  const prefix = `${challengeId}/${userId}/`;
  return path.startsWith(prefix) && path.length > prefix.length && !path.includes("..") && /^[A-Za-z0-9/_.-]+$/.test(path);
}

export function isOwnedAvatarPath(path: string, userId: string): boolean {
  const prefix = `${userId}/`;
  return path.startsWith(prefix) && path.length > prefix.length && !path.includes("..") && /^[A-Za-z0-9/_.-]+$/.test(path);
}
