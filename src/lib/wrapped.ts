import { ACTIVITIES, type ActivityKey } from "./constants";
import { addDays, diffDays, type DateKey } from "./dates";
import { computeStreakStats } from "./streaks";

export interface WrappedMember {
  id: string;
  display_name: string;
  avatar_path: string | null;
}

export interface WrappedInput {
  members: WrappedMember[];
  checkins: { user_id: string; checkin_date: DateKey; activities: string[] }[];
  posts: { user_id: string; image_path: string; created_at: string; caption: string | null; id: string }[];
  recipes: { user_id: string }[];
  compliments: { sender_id: string; receiver_id: string }[];
  challenge: { start_date: DateKey; end_date: DateKey };
  /** "today" used for streak math; pass the day after end_date for the final version. */
  today: DateKey;
}

export interface PersonalWrapped {
  member: WrappedMember;
  totalDays: number;
  longestStreak: number;
  topActivity: { key: ActivityKey; label: string; emoji: string; count: number } | null;
  recipesShared: number;
  photosShared: number;
  complimentsReceived: number;
  complimentsSent: number;
}

export interface GroupWrapped {
  totalCheckinDays: number;
  totalPhotos: number;
  totalRecipes: number;
  totalCompliments: number;
  longestStreakInGroup: number;
  /** Days on which at least one member checked in. */
  activeChallengeDays: number;
  /** Days on which every member checked in. */
  fullSquadDays: number;
  challengeLength: number;
}

export interface WrappedResult {
  group: GroupWrapped;
  personal: PersonalWrapped[];
  memories: WrappedInput["posts"];
}

export function computeWrapped(input: WrappedInput): WrappedResult {
  const { members, checkins, posts, recipes, compliments, challenge, today } = input;

  const inRange = checkins.filter(
    (c) => c.checkin_date >= challenge.start_date && c.checkin_date <= challenge.end_date,
  );

  const personal: PersonalWrapped[] = members.map((member) => {
    const mine = inRange.filter((c) => c.user_id === member.id);
    const stats = computeStreakStats(
      mine.map((c) => c.checkin_date),
      today,
    );
    const counts = new Map<string, number>();
    for (const c of mine) for (const a of c.activities) counts.set(a, (counts.get(a) ?? 0) + 1);
    let top: PersonalWrapped["topActivity"] = null;
    for (const a of ACTIVITIES) {
      const n = counts.get(a.key) ?? 0;
      if (n > 0 && (!top || n > top.count)) top = { key: a.key, label: a.label, emoji: a.emoji, count: n };
    }
    return {
      member,
      totalDays: stats.total,
      longestStreak: stats.longest,
      topActivity: top,
      recipesShared: recipes.filter((r) => r.user_id === member.id).length,
      photosShared: posts.filter((p) => p.user_id === member.id).length,
      complimentsReceived: compliments.filter((c) => c.receiver_id === member.id).length,
      complimentsSent: compliments.filter((c) => c.sender_id === member.id).length,
    };
  });

  const perDay = new Map<DateKey, Set<string>>();
  for (const c of inRange) {
    if (!perDay.has(c.checkin_date)) perDay.set(c.checkin_date, new Set());
    perDay.get(c.checkin_date)!.add(c.user_id);
  }
  let fullSquadDays = 0;
  for (const users of perDay.values()) if (members.length > 0 && users.size >= members.length) fullSquadDays += 1;

  const group: GroupWrapped = {
    totalCheckinDays: personal.reduce((s, p) => s + p.totalDays, 0),
    totalPhotos: posts.length,
    totalRecipes: recipes.length,
    totalCompliments: compliments.length,
    longestStreakInGroup: personal.reduce((m, p) => Math.max(m, p.longestStreak), 0),
    activeChallengeDays: perDay.size,
    fullSquadDays,
    challengeLength: diffDays(challenge.start_date, challenge.end_date) + 1,
  };

  // Memories: spread across the challenge, newest first within a cap.
  const memories = [...posts]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 12);

  return { group, personal, memories };
}

/** Helper for the final run: the "today" that closes all streaks at the end date. */
export function wrappedToday(endDate: DateKey): DateKey {
  return addDays(endDate, 0);
}
