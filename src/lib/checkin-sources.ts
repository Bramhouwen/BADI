import { ACTIVITY_KEYS, type ActivityKey } from "./constants";

export interface SourceLike {
  activity: string;
  source: "manual" | "workout" | string;
}

/**
 * The effective activities of a day: the union of every source still present.
 * Manual ticks and workouts never double count; each activity appears once.
 */
export function effectiveActivities(sources: SourceLike[]): ActivityKey[] {
  const set = new Set<ActivityKey>();
  for (const s of sources) if ((ACTIVITY_KEYS as string[]).includes(s.activity)) set.add(s.activity as ActivityKey);
  return ACTIVITY_KEYS.filter((k) => set.has(k));
}
