/**
 * What your character says when you open the app for the first time each day:
 * a greeting by time of day and one line about your own day, chosen from your
 * real numbers. Pure, so it is the same on every render of one day and differs
 * from the day before.
 */
import { diffDays, type DateKey } from "./dates";
import type { SpriteAnim } from "./sprites";

export interface WelcomeFacts {
  name: string;
  userId: string;
  date: DateKey;
  /** Hour of the day in the challenge timezone, 0 to 23. */
  hour: number;
  /** 0 is Monday, 6 is Sunday. */
  weekday: number;
  checkedInToday: boolean;
  yesterdayComplete: boolean;
  streak: number;
  weekSteps: number;
  stepsGoal: number;
  run: { done: number; target: number };
  strength: { done: number; target: number };
  waterMl: number;
  waterGoalMl: number;
  superBadi: boolean;
  canSpin: boolean;
  /** Title of this week's open Weekrad challenge. */
  openChallenge: string | null;
  /** Members with unread private messages to you. */
  unreadFrom: { id: string; name: string }[];
  /** Days until the last challenge day. */
  finaleIn: number;
}

export interface WelcomeMessage {
  greeting: string;
  line: string;
  anim: SpriteAnim;
  action: { label: string; href: string } | null;
}

const nl = (n: number) => new Intl.NumberFormat("nl-NL").format(Math.round(n));
const liters = (ml: number) => new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 }).format(ml / 1000);

/** Stable number for a string. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Index for today that is never the same as yesterday's (for lists of 2 or more). */
function rotate(length: number, facts: WelcomeFacts, salt: string): number {
  if (length < 2) return 0;
  const day = diffDays("2026-01-01", facts.date);
  return (day + (hash(facts.userId + salt) % length)) % length;
}

function pick<T>(list: readonly T[], facts: WelcomeFacts, salt: string): T {
  return list[rotate(list.length, facts, salt)];
}

type Daypart = "night" | "morning" | "afternoon" | "evening";

export function daypart(hour: number): Daypart {
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

const GREETINGS: Record<Daypart, ((n: string) => string)[]> = {
  morning: [
    (n) => `Hi ${n}, laten we er een mooie dag van maken.`,
    (n) => `Goedemorgen ${n}! Klaar voor vandaag?`,
    (n) => `Morning ${n}! Nieuwe dag, nieuwe kansen.`,
    (n) => `Hé ${n}, lekker dat je er bent.`,
    (n) => `Goedemorgen ${n}. Vandaag pakken we hem.`,
    (n) => `Hi ${n}! Koffie erbij en gaan.`,
    (n) => `Rise and shine, ${n}!`,
    (n) => `Daar ben je, ${n}. Wat gaan we vandaag doen?`,
  ],
  afternoon: [
    (n) => `Hi ${n}, hoe gaat je dag tot nu toe?`,
    (n) => `Goedemiddag ${n}! Halverwege de dag.`,
    (n) => `Hé ${n}, goed om je te zien.`,
    (n) => `Hi ${n}! Even een check-moment.`,
    (n) => `Middag ${n}. De dag is nog lang genoeg.`,
    (n) => `Daar is ${n}! Hoe staat het ervoor?`,
  ],
  evening: [
    (n) => `Goedenavond ${n}, hoe was je dag?`,
    (n) => `Hi ${n}, nog even de dag afronden?`,
    (n) => `Hé ${n}, fijn dat je even binnenkomt.`,
    (n) => `Avond ${n}! Tijd om de balans op te maken.`,
    (n) => `Hi ${n}. Bijna klaar voor vandaag.`,
    (n) => `Goedenavond ${n}! Nog één rondje langs je doelen.`,
  ],
  night: [
    (n) => `Nog wakker, ${n}?`,
    (n) => `Hi ${n}, het is al laat. Slaap telt ook mee.`,
    (n) => `Nachtuil ${n}! Morgen weer een dag.`,
  ],
};

interface Candidate {
  /** Higher goes first; within one level the day decides which one you get. */
  weight: number;
  lines: string[];
  anim: SpriteAnim;
  action: WelcomeMessage["action"];
}

function candidates(f: WelcomeFacts): Candidate[] {
  const out: Candidate[] = [];
  const part = daypart(f.hour);
  const daysLeft = 7 - f.weekday;

  if (f.unreadFrom.length > 0) {
    const names = f.unreadFrom.map((u) => u.name);
    const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} en ${names[names.length - 1]}`;
    out.push({
      weight: 5,
      lines: [`${who} ${f.unreadFrom.length === 1 ? "heeft" : "hebben"} je een bericht gestuurd.`, `Er ligt een bericht van ${who} op je te wachten.`],
      anim: "wave",
      action: { label: f.unreadFrom.length === 1 ? "Lees je bericht" : "Lees je berichten", href: f.unreadFrom.length === 1 ? `/squad/chat/${f.unreadFrom[0].id}` : "/squad" },
    });
  }
  if (f.superBadi) {
    out.push({
      weight: 4,
      lines: ["Jij bent deze week de Super Badi. Hou je de kroon vast?", "De kroon is van jou deze week. Laat zien waarom.", "Super Badi van de week! Iedereen wil je troon."],
      anim: "cheer",
      action: null,
    });
  }
  if (f.canSpin) {
    out.push({
      weight: 4,
      lines: ["Je hebt deze week nog een draai aan het Weekrad tegoed.", "Het Weekrad staat klaar. Wat ga jij winnen?", "Er wacht nog een draai op je bij het Weekrad."],
      anim: "happy",
      action: { label: "Naar het Weekrad", href: "/wheel" },
    });
  }
  if (f.openChallenge) {
    out.push({
      weight: 3,
      lines: [`Je weekchallenge staat nog open: ${f.openChallenge}.`, `Vergeet je challenge niet: ${f.openChallenge}. Goed voor +5 bonus.`],
      anim: "squat",
      action: { label: "Bekijk je challenge", href: "/wheel/prizes" },
    });
  }
  if (!f.checkedInToday && part === "evening") {
    out.push({
      weight: 4,
      lines: ["Je check-in van vandaag staat nog open.", "Nog even afvinken wat je vandaag gedaan hebt?"],
      anim: "wave",
      action: { label: "Naar je check-in", href: "/checkin" },
    });
  }
  if (f.yesterdayComplete) {
    out.push({
      weight: 2,
      lines: ["Gisteren had je alles afgevinkt. Zo door!", "Gisteren een volle dag. Doen we dat nog een keer?", "Alles gehaald gisteren. Sterk bezig."],
      anim: "happy",
      action: null,
    });
  }
  if (f.weekSteps >= f.stepsGoal) {
    out.push({
      weight: 2,
      lines: [`Je weekdoel van ${nl(f.stepsGoal)} stappen heb je al binnen.`, `${nl(f.weekSteps)} stappen deze week. Doel gehaald!`],
      anim: "cheer",
      action: null,
    });
  } else if (f.weekday > 0 || f.weekSteps > 0) {
    const left = f.stepsGoal - f.weekSteps;
    out.push({
      weight: 2,
      lines: [
        `Nog ${nl(left)} stappen voor je weekdoel, zo'n ${nl(left / daysLeft)} per dag.`,
        `Je staat op ${nl(f.weekSteps)} stappen deze week. Nog ${nl(left)} te gaan.`,
      ],
      anim: "walk",
      action: { label: "Stappen invullen", href: "/checkin" },
    });
  }
  const runLeft = f.run.target - f.run.done;
  if (runLeft > 0) {
    out.push({
      weight: 1,
      lines: [`Nog ${runLeft}x hardlopen deze week voor je doel.`, `${f.run.done} van de ${f.run.target} hardlooprondjes gedaan deze week.`],
      anim: "walk",
      action: null,
    });
  }
  const strengthLeft = f.strength.target - f.strength.done;
  if (strengthLeft > 0) {
    out.push({
      weight: 1,
      lines: [`Nog ${strengthLeft}x krachttraining deze week voor je doel.`, `${f.strength.done} van de ${f.strength.target} krachttrainingen staan erop deze week.`],
      anim: "squat",
      action: null,
    });
  }
  if (part !== "morning" && f.waterMl < f.waterGoalMl) {
    out.push({
      weight: 1,
      lines: [`Je zit op ${liters(f.waterMl)} liter water vandaag. Nog ${liters(f.waterGoalMl - f.waterMl)} te gaan.`, "Al genoeg gedronken vandaag? Pak er even een glas water bij."],
      anim: "stand",
      action: { label: "Water bijhouden", href: "/water" },
    });
  }
  if (f.streak >= 3) {
    out.push({
      weight: 1,
      lines: [`${f.streak} dagen op rij ingecheckt.`, `Je streak staat op ${f.streak} dagen.`],
      anim: "happy",
      action: null,
    });
  }
  if (f.finaleIn >= 0 && f.finaleIn <= 7) {
    out.push({
      weight: 3,
      lines: [f.finaleIn === 0 ? "Vandaag is de finale van de Winter Arc!" : `Nog ${f.finaleIn} ${f.finaleIn === 1 ? "dag" : "dagen"} tot de finale.`],
      anim: "cheer",
      action: null,
    });
  }
  return out;
}

export function welcomeMessage(f: WelcomeFacts): WelcomeMessage {
  const part = daypart(f.hour);
  const greeting = pick(GREETINGS[part], f, "greeting")(f.name);
  const all = candidates(f);
  if (all.length === 0) {
    return { greeting, line: "Fijn dat je er bent. Kijk even wat er vandaag op je wacht.", anim: part === "night" ? "sit" : "wave", action: null };
  }
  // The most important things first; among the top two levels the day rotates, so the line changes daily.
  const top = Math.max(...all.map((c) => c.weight));
  const pool = all.filter((c) => c.weight >= top - 1).sort((a, b) => b.weight - a.weight);
  const urgent = all.filter((c) => c.weight === 5);
  const chosen = urgent.length > 0 ? urgent[0] : pick(pool, f, "line");
  const line = pick(chosen.lines, f, `line:${chosen.lines[0]}`);
  return { greeting, line, anim: part === "night" ? "sit" : chosen.anim, action: chosen.action };
}
