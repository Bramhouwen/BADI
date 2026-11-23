import { ACTIVITIES, type ActivityKey } from "./constants";
import { addDays, diffDays, type DateKey } from "./dates";
import { computeStreakStats } from "./streaks";
import { stepsByDay, weekScore, weekStartOf, type BonusItem } from "./checkin-plan";

/**
 * The interim Wrapped ("tussenstand"): a first look at the Winter Arc so far,
 * before the finale. Closed: only the admin sees it, through /wrapped?tussenstand=1.
 * Open: every member sees it on /wrapped until the finale.
 */
export const INTERIM_WRAPPED_OPEN = false;

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

export interface SeasonInput {
  challenge: { start_date: DateKey; end_date: DateKey };
  /** Last day that counts: today during the finale, the end date afterwards. */
  until: DateKey;
  checkins: { checkin_date: DateKey; activities: readonly string[] }[];
  jokers: DateKey[];
  steps: { log_date: DateKey; steps: number }[];
  bonus: readonly BonusItem[];
}

export interface SeasonStats {
  /** Week points plus bonus over every week of the challenge. */
  points: number;
  bonus: number;
  /** Steps on the days of the challenge; a ticked day without a count is 10,000. */
  steps: number;
  bestWeek: { start: DateKey; points: number } | null;
}

/** One member's season: the week score of every challenge week added up, plus the steps walked. */
export function seasonStats({ challenge, until, checkins, jokers, steps, bonus }: SeasonInput): SeasonStats {
  const last = until < challenge.end_date ? until : challenge.end_date;
  let points = 0;
  let bonusPoints = 0;
  let walked = 0;
  let bestWeek: SeasonStats["bestWeek"] = null;
  if (last < challenge.start_date) return { points, bonus: bonusPoints, steps: walked, bestWeek };
  for (let w = weekStartOf(challenge.start_date); w <= last; w = addDays(w, 7)) {
    const end = addDays(w, 6);
    const week = weekScore(
      w,
      checkins.filter((c) => c.checkin_date >= w && c.checkin_date <= end),
      jokers.filter((j) => j >= w && j <= end),
      steps.filter((s) => s.log_date >= w && s.log_date <= end),
      bonus,
    );
    const total = week.earned + week.bonus;
    points += total;
    bonusPoints += week.bonus;
    if (total > 0 && (!bestWeek || total > bestWeek.points)) bestWeek = { start: w, points: total };
    for (const [date, n] of Object.entries(stepsByDay(w, steps, checkins))) {
      if (date >= challenge.start_date && date <= last) walked += n;
    }
  }
  return { points, bonus: bonusPoints, steps: walked, bestWeek };
}

/** How often each member wore the Super Badi crown; a shared week counts for everyone in it. */
export function crownCounts(awards: readonly { user_ids: readonly string[] }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of awards) for (const id of new Set(a.user_ids)) out.set(id, (out.get(id) ?? 0) + 1);
  return out;
}

export interface WheelSummary {
  prizes: { brand: string; name: string }[];
  challengesDone: number;
}

/** Prizes won (duplicates that were swapped are already rewritten) and finished week challenges per member. */
export function wheelSummary(
  spins: readonly { user_id: string; category: string; prize_brand: string | null; prize_name: string | null; challenge_completed_at: string | null }[],
): Map<string, WheelSummary> {
  const out = new Map<string, WheelSummary>();
  for (const s of spins) {
    const cur = out.get(s.user_id) ?? { prizes: [], challengesDone: 0 };
    if (s.category === "challenge") {
      if (s.challenge_completed_at) cur.challengesDone += 1;
    } else if (s.prize_name) {
      cur.prizes.push({ brand: s.prize_brand ?? "", name: s.prize_name });
    }
    out.set(s.user_id, cur);
  }
  return out;
}
