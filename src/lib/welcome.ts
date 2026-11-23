/**
 * What your character tells you on Home. It has one role: your buddy brings
 * news and celebrates with you. It never tells you what you still have to do;
 * reminders are Baddy's job (07:00 and 21:00) and the cards on Home.
 *
 * Three kinds of lines, at most three in total:
 * - news: something happened for you (a message, a compliment, Super Badi,
 *   a new spin on Monday, something new from the squad, the finale nearing);
 * - win: something you achieved (yesterday complete, a streak, the steps
 *   goal, yesterday's training);
 * - squad: how the others are doing.
 * Pure, so the brief is the same all day and rotates from day to day.
 */
import { addDays, diffDays, type DateKey } from "./dates";
import type { SpriteAnim } from "./sprites";

/** A line spoken in a full-screen moment (announcement, own introduction). */
export interface WelcomeMessage {
  greeting: string;
  line: string;
  anim: SpriteAnim;
  action: { label: string; href: string } | null;
}

export interface BuddyFacts {
  userId: string;
  date: DateKey;
  /** Hour of the day in the challenge timezone, 0 to 23. */
  hour: number;
  /** 0 is Monday, 6 is Sunday. */
  weekday: number;
  yesterdayComplete: boolean;
  streak: number;
  weekSteps: number;
  stepsGoal: number;
  /** Date of your last finished workout. */
  lastWorkoutDate: DateKey | null;
  superBadi: boolean;
  canSpin: boolean;
  /** Members with unread private messages to you. */
  unreadFrom: { id: string; name: string }[];
  complimentsUnread: number;
  /** The newest Wall photo or recipe by someone else since yesterday. */
  squadNew: { name: string; kind: "post" | "recipe"; href: string } | null;
  /** First names of the others who had every daily habit done yesterday. */
  squadCompleteYesterday: string[];
  /** Steps of the whole squad this week, as far as members share them. */
  squadWeekSteps: number;
  /** Days until the last challenge day. */
  finaleIn: number;
}

export type BriefKind = "news" | "win" | "squad";

export interface BriefItem {
  kind: BriefKind;
  icon: string;
  text: string;
  href: string | null;
}

export interface BuddyBrief {
  items: BriefItem[];
  /** How the character moves while it tells this. */
  anim: SpriteAnim;
}

const nl = (n: number) => new Intl.NumberFormat("nl-NL").format(Math.round(n));

/** "Sam", "Sam en Noor", "Sam, Noor en Alex". */
export function joinNl(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} en ${names[names.length - 1]}`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** One of `list` for today, never the same as yesterday's (for 2 or more). */
function pick<T>(list: readonly T[], f: BuddyFacts, salt: string): T {
  if (list.length < 2) return list[0];
  const day = diffDays("2026-01-01", f.date);
  return list[(day + (hash(f.userId + salt) % list.length)) % list.length];
}

function news(f: BuddyFacts): BriefItem[] {
  const out: BriefItem[] = [];
  if (f.unreadFrom.length > 0) {
    const names = f.unreadFrom.map((u) => u.name);
    out.push({
      kind: "news",
      icon: "💬",
      text: names.length === 1 ? `${names[0]} stuurde je een bericht.` : `${joinNl(names)} stuurden je een bericht.`,
      href: names.length === 1 ? `/squad/chat/${f.unreadFrom[0].id}` : "/squad",
    });
  }
  if (f.complimentsUnread > 0) {
    out.push({ kind: "news", icon: "💌", text: f.complimentsUnread === 1 ? "Je hebt een nieuw compliment." : `Je hebt ${f.complimentsUnread} nieuwe complimenten.`, href: "/squad/compliments" });
  }
  if (f.superBadi && f.weekday === 0) out.push({ kind: "news", icon: "👑", text: "Jij bent de Super Badi van vorige week!", href: null });
  if (f.canSpin && f.weekday === 0) out.push({ kind: "news", icon: "🎡", text: "Er staat een nieuwe draai voor je klaar bij het Weekrad.", href: "/wheel" });
  if (f.finaleIn >= 0 && f.finaleIn <= 7) out.push({ kind: "news", icon: "🏁", text: f.finaleIn === 0 ? "Vandaag is de finale!" : `Nog ${f.finaleIn} ${f.finaleIn === 1 ? "dag" : "dagen"} tot de finale.`, href: null });
  if (f.squadNew) {
    out.push({ kind: "news", icon: f.squadNew.kind === "recipe" ? "🥗" : "📸", text: f.squadNew.kind === "recipe" ? `${f.squadNew.name} deelde een nieuw recept.` : `${f.squadNew.name} zette een foto op de Wall.`, href: f.squadNew.href });
  }
  return out;
}

function win(f: BuddyFacts): BriefItem | null {
  if (f.streak >= 7 && f.streak % 7 === 0) return { kind: "win", icon: "🔥", text: `${f.streak} dagen op rij ingecheckt!`, href: null };
  const options: BriefItem[] = [];
  if (f.yesterdayComplete) options.push({ kind: "win", icon: "✅", text: "Gisteren had je alles afgevinkt.", href: null });
  if (f.weekSteps >= f.stepsGoal) options.push({ kind: "win", icon: "👟", text: `Je weekdoel van ${nl(f.stepsGoal)} stappen is binnen.`, href: null });
  if (f.lastWorkoutDate === addDays(f.date, -1)) options.push({ kind: "win", icon: "💪", text: "Je training van gisteren staat erop.", href: null });
  if (f.streak >= 3) options.push({ kind: "win", icon: "🔥", text: `${f.streak} dagen op rij ingecheckt.`, href: null });
  return options.length ? pick(options, f, "win") : null;
}

function squad(f: BuddyFacts): BriefItem | null {
  const options: BriefItem[] = [];
  if (f.squadCompleteYesterday.length > 0) {
    const names = f.squadCompleteYesterday;
    options.push({ kind: "squad", icon: "👀", text: `${joinNl(names)} ${names.length === 1 ? "had" : "hadden"} gisteren alles afgevinkt.`, href: "/squad" });
  }
  if (f.squadWeekSteps >= 10_000) options.push({ kind: "squad", icon: "👣", text: `Samen al ${nl(f.squadWeekSteps)} stappen deze week.`, href: "/squad" });
  return options.length ? pick(options, f, "squad") : null;
}

export function buddyBrief(f: BuddyFacts): BuddyBrief {
  const items: BriefItem[] = [];
  items.push(...news(f).slice(0, 2));
  const w = win(f);
  if (w && items.length < 3) items.push(w);
  const s = squad(f);
  if (s && items.length < 3) items.push(s);

  const night = f.hour < 6;
  const anim: SpriteAnim = night
    ? "sit"
    : items.some((i) => i.icon === "👑")
      ? "cheer"
      : items[0]?.kind === "news"
        ? "wave"
        : items.some((i) => i.kind === "win")
          ? "happy"
          : "wave";
  return { items, anim };
}
