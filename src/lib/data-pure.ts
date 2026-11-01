/** Pure helpers shared by the server data layer and tests. */
export function rotateMembers<T>(members: T[], dayNumber: number): T[] {
  if (members.length === 0) return members;
  const offset = ((dayNumber % members.length) + members.length) % members.length;
  return [...members.slice(offset), ...members.slice(0, offset)];
}
