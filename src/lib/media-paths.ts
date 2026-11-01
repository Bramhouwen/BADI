/** Pure validators for storage object paths (shared by server code and tests). */
export function isOwnedMediaPath(path: string, challengeId: string, userId: string): boolean {
  const prefix = `${challengeId}/${userId}/`;
  return path.startsWith(prefix) && path.length > prefix.length && !path.includes("..") && /^[A-Za-z0-9/_.-]+$/.test(path);
}

export function isOwnedAvatarPath(path: string, userId: string): boolean {
  const prefix = `${userId}/`;
  return path.startsWith(prefix) && path.length > prefix.length && !path.includes("..") && /^[A-Za-z0-9/_.-]+$/.test(path);
}
