import { motionKey } from "@/lib/exercise-motion/library";

/** Exercises with a filmed demo in public/exercise-videos: <slug>.mp4 plus a <slug>.jpg poster of the first frame. */
const FILMED = [
  "Squat",
  "Leg Press",
  "Lunges",
  "Romanian Deadlift",
  "Leg Extension",
  "Leg Curl",
  "Calf Raise",
  "Bench Press",
  "Incline Dumbbell Press",
  "Chest Fly",
  "Push-up",
  "Lat Pulldown",
  "Seated Row",
  "Bent-over Row",
  "Pull-up",
  "Shoulder Press",
  "Lateral Raise",
  "Rear Delt Fly",
  "Bicep Curl",
  "Hammer Curl",
  "Tricep Pushdown",
  "Tricep Extension",
  "Plank",
  "Crunch",
  "Leg Raise",
  "Russian Twist",
  "Jumping Jacks",
  "Arm Circles",
  "High Knees",
  "Leg Swings",
  "Glute Bridge",
  "Cat-Cow",
  "Bird Dog",
  "Downward Dog",
  "Hip Flexor Stretch",
  "Inchworm",
] as const;

/** "Bent-over Row" becomes "bent-over-row". */
export function videoSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const BY_KEY = new Map<string, string>(FILMED.map((n) => [motionKey(n), videoSlug(n)]));

export interface ExerciseMedia {
  video: string;
  poster: string;
}

/** The demo clip and poster for an exercise, matched loosely on name ("Push up" finds "Push-up"). */
export function exerciseMedia(name: string): ExerciseMedia | null {
  const slug = BY_KEY.get(motionKey(name));
  return slug ? { video: `/exercise-videos/${slug}.mp4`, poster: `/exercise-videos/${slug}.jpg` } : null;
}

export const FILMED_EXERCISES: readonly string[] = FILMED;

/** Cover for a workout: the clip of the first exercise that has one. */
export function coverFor(names: readonly string[]): (ExerciseMedia & { name: string }) | null {
  for (const name of names) {
    const media = exerciseMedia(name);
    if (media) return { ...media, name };
  }
  return null;
}
