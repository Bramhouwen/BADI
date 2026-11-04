/**
 * Baddy's morning (07:00) and evening (21:00) push messages. Pure functions:
 * the texts rotate per member and per day, so two days in a row never get
 * the same message and squad members get different ones on the same day.
 */
import { diffDays, type DateKey } from "@/lib/dates";
import { dailyScore, type TrainingKind } from "@/lib/checkin-plan";
import { computeStreakStats } from "@/lib/streaks";

export type CoachSlot = "morning" | "evening";

export interface DailyInput {
  userId: string;
  firstName: string;
  today: DateKey;
  startDate: DateKey;
  endDate: DateKey;
  checkinDates: DateKey[];
  todayActivities: string[];
  jokerToday: boolean;
  plannedToday: TrainingKind[];
}

interface Vars {
  name: string;
  day: number;
  length: number;
  streak: number;
  done: number;
  total: number;
  left: number;
  training: string | null;
}

type Template = { text: (v: Vars) => string; when?: (v: Vars) => boolean };

const MORNING: Template[] = [
  { text: (v) => `Je zit vandaag op dag ${v.day}, ${v.name}. De squad is trots op je en we gaan vandaag weer knallen!` },
  { text: (v) => `Goedemorgen ${v.name}! Dag ${v.day} van de Winter Arc. Eén dag tegelijk, en vandaag is jouw dag.` },
  { text: (v) => `Rise and shine ${v.name}! Je streak staat op ${v.streak}. Vandaag houden we 'm vast.`, when: (v) => v.streak >= 2 },
  { text: (v) => `Goedemorgen ${v.name}. Begin met een groot glas water, de rest volgt vanzelf. Dag ${v.day}, we gaan ervoor.` },
  { text: (v) => `${v.name}, dag ${v.day} staat klaar. De squad rekent op je, en jij kunt dit.` },
  { text: (v) => `Nieuwe dag, nieuwe kansen ${v.name}. Dag ${v.day} van ${v.length}: laat zien wat je kan.` },
  { text: (v) => `Hé ${v.name}! Vandaag is dag ${v.day}. Kleine stappen, grote winter. Knallen!` },
  { text: (v) => `Goedemorgen kampioen. Dag ${v.day} van de Winter Arc, ${v.name}. Ik geloof in je.` },
  { text: (v) => `${v.name}, elke wandeling telt mee voor je 70.000 stappen deze week. Dag ${v.day}, zet 'm op!` },
  { text: (v) => `Dag ${v.day}, ${v.name}! Eiwit bij je ontbijt en je bent al goed op weg.` },
  { text: (v) => `Al ${v.day} dagen bezig, ${v.name}. Dat is geen toeval, dat ben jij. Goedemorgen!` },
  { text: (v) => `Opstaan ${v.name}, de Winter Arc wacht. Dag ${v.day}, de squad staat naast je.` },
];

const EVENING: Template[] = [
  { text: (v) => `Hoe vond je het vandaag gaan, ${v.name}? Ik ben trots op je!` },
  { text: (v) => `Dag ${v.day} zit erop, ${v.name}. Je staat op ${v.done} van ${v.total} punten. Trots op je!`, when: (v) => v.done > 0 },
  { text: (v) => `${v.name}, nog even je check-in afronden? Je staat op ${v.done} van ${v.total}, nog ${v.left} te gaan.`, when: (v) => v.left > 0 },
  { text: (v) => `Alle ${v.total} punten gehaald vandaag, ${v.name}. Wat een dag!`, when: (v) => v.left === 0 },
  { text: (v) => `Mooi gewerkt vandaag, ${v.name}. Rust goed uit, morgen gaan we verder.` },
  { text: (v) => `Hoe was je dag, ${v.name}? Even je check-in doen en dan lekker slapen.` },
  { text: (v) => `${v.name}, elke dag dat je showt telt. Vandaag ook. Slaap lekker!` },
  { text: (v) => `Klaar voor de nacht, ${v.name}? 7 tot 9 uur slaap, dan ben je morgen weer scherp.` },
  { text: (v) => `${v.name}, vul je stappen van vandaag nog even in. Ze tellen mee voor je 70.000 deze week.` },
  { text: (v) => `Trots op je, ${v.name}. ${v.streak} dagen op rij. Morgen weer!`, when: (v) => v.streak >= 2 },
  { text: (v) => `Dag ${v.day} van ${v.length} afgevinkt, ${v.name}. De squad is trots, ik ook.` },
];

const TRAINING: Record<TrainingKind, string> = { run: "hardlopen", strength: "krachttraining" };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dailyVars(input: DailyInput): Vars {
  const streak = computeStreakStats(input.checkinDates, input.today).current;
  const score = dailyScore(input.todayActivities, input.jokerToday);
  const training = input.plannedToday.length ? input.plannedToday.map((k) => TRAINING[k]).join(" en ") : null;
  return {
    name: input.firstName,
    day: diffDays(input.startDate, input.today) + 1,
    length: diffDays(input.startDate, input.endDate) + 1,
    streak,
    done: score.done,
    total: score.total,
    left: score.total - score.done,
    training,
  };
}

/** Index into the eligible templates: shifts by one each day, offset per member. */
export function pickIndex(userId: string, day: number, slot: CoachSlot, count: number): number {
  return (hash(`${userId}:${slot}`) + day) % count;
}

export function dailyMessage(input: DailyInput, slot: CoachSlot): { title: string; body: string } {
  const v = dailyVars(input);
  const pool = (slot === "morning" ? MORNING : EVENING).filter((t) => !t.when || t.when(v));
  let body = pool[pickIndex(input.userId, v.day, slot, pool.length)].text(v);
  if (slot === "morning" && v.training) body += ` Op de planning: ${v.training}.`;
  const title = slot === "morning" ? "Baddy ☀️" : "Baddy 🌙";
  return { title, body };
}

export function slotFromHour(hour: number): CoachSlot | null {
  if (hour === 7) return "morning";
  if (hour === 21) return "evening";
  return null;
}
