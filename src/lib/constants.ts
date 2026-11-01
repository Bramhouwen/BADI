export const APP_NAME = "BADI";
export const TAGLINE = "Run Squat.";
export const TIMEZONE = "Europe/Amsterdam";

export const DEFAULT_CHALLENGE = {
  name: "Winter Arc 2026",
  start_date: "2026-11-01",
  end_date: "2026-12-31",
  timezone: TIMEZONE,
} as const;

export const MAX_MEMBERS = 4;
export const MAX_ALCOHOL_EXCEPTIONS = 2;

/** Daily hydration guideline (the challenge mentions 2,5 tot 3 liter). */
export const WATER_GOAL_ML = 2500;
export const WATER_MAX_ENTRY_ML = 3000;
export const WATER_QUICK_ADD: { ml: number; label: string; emoji: string }[] = [
  { ml: 250, label: "Glas", emoji: "🥛" },
  { ml: 500, label: "Fles", emoji: "💧" },
  { ml: 200, label: "Kop thee", emoji: "🍵" },
  { ml: 750, label: "Grote fles", emoji: "🚰" },
];

export type ActivityKey =
  | "moved"
  | "strength"
  | "nutrition"
  | "recovery"
  | "hydration"
  | "alcohol";

export const ACTIVITIES: { key: ActivityKey; emoji: string; label: string; hint: string }[] = [
  { key: "moved", emoji: "🚶", label: "Bewogen", hint: "Wandelen, fietsen, sporten" },
  { key: "strength", emoji: "🏋️", label: "Krachttraining", hint: "Een sessie in de gym of thuis" },
  { key: "nutrition", emoji: "🥑", label: "Bewust gegeten", hint: "Puur, gevarieerd, genoeg eiwit" },
  { key: "recovery", emoji: "😴", label: "Goed hersteld", hint: "Rust, slaap of een bewuste rustdag" },
  { key: "hydration", emoji: "💧", label: "Goed gehydrateerd", hint: "Genoeg water gedronken" },
  { key: "alcohol", emoji: "🍷", label: "Alcoholbewust", hint: "Geen of bewust weinig alcohol" },
];

export const ACTIVITY_KEYS = ACTIVITIES.map((a) => a.key) as ActivityKey[];

export function activityByKey(key: string) {
  return ACTIVITIES.find((a) => a.key === key);
}

export type ReactionKey = "fire" | "muscle" | "heart" | "snow" | "clap";

export const REACTIONS: { key: ReactionKey; emoji: string; label: string }[] = [
  { key: "fire", emoji: "🔥", label: "Vuur" },
  { key: "muscle", emoji: "💪", label: "Sterk" },
  { key: "heart", emoji: "❤️", label: "Liefde" },
  { key: "snow", emoji: "❄️", label: "Winter Arc" },
  { key: "clap", emoji: "👏", label: "Applaus" },
];

export const REACTION_KEYS = REACTIONS.map((r) => r.key) as ReactionKey[];

export const PRESET_COMPLIMENTS = [
  "🔥 Lekker bezig!",
  "💪 Trots op je!",
  "❄️ Keep showing up!",
  "👏 Goed dat je blijft doorgaan!",
  "❤️ Jij motiveert me!",
] as const;

export const RECIPE_CATEGORIES = [
  "Ontbijt",
  "Lunch",
  "Diner",
  "Snack",
  "Shake",
  "Dessert",
] as const;

export const PRINCIPLES = [
  {
    emoji: "🥑",
    title: "Whole foods",
    body: "Eet vooral voedzaam, zo min mogelijk bewerkt eten. Balans gaat boven perfectie.",
  },
  {
    emoji: "🏋️",
    title: "Strength training",
    body: "Mik op twee tot drie krachtsessies per week, passend bij jouw niveau. Focus op techniek, progressie en regelmaat.",
  },
  {
    emoji: "🚶",
    title: "Daily movement",
    body: "Richtlijn: zo'n 10.000 stappen per dag, als dat bij je past. Wandelen en gewoon bewegen tellen volop mee.",
  },
  {
    emoji: "🍳",
    title: "Protein",
    body: "Eet genoeg eiwit voor herstel en spieropbouw. Grammen bijhouden hoeft niet.",
  },
  {
    emoji: "😴",
    title: "Sleep",
    body: "Geef rust prioriteit. Zeven tot negen uur is een algemene richtlijn voor volwassenen, iedereen is anders.",
  },
  {
    emoji: "💧",
    title: "Hydration",
    body: "Blijf goed gehydrateerd. De challenge noemt 2,5 tot 3 liter als richtlijn, maar wat jij nodig hebt verschilt per persoon.",
  },
  {
    emoji: "🍷",
    title: "Alcohol awareness",
    body: "Mik op een alcoholvrije challenge, met maximaal twee vooraf gekozen uitzonderingsmomenten. Die houd je privé bij, niemand anders ziet ze.",
  },
] as const;
