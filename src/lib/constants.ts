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
export const WATER_QUICK_ADD: { ml: number; label: string; icon: "glass" | "bottle" | "cup" | "big" }[] = [
  { ml: 250, label: "Glas", icon: "glass" },
  { ml: 500, label: "Fles", icon: "bottle" },
  { ml: 200, label: "Kop thee", icon: "cup" },
  { ml: 750, label: "Grote fles", icon: "big" },
];

export type ActivityKey =
  | "steps"
  | "hydration"
  | "nutrition"
  | "protein"
  | "recovery"
  | "alcohol"
  | "run"
  | "strength"
  | "moved";

export type ActivityKind = "daily" | "weekly" | "steps" | "extra";

/**
 * Check-in parts. Daily habits are ticked every day; weekly trainings have a
 * target per week and come from Fitness or a manual tick; "moved" collects
 * other workouts (walking, cycling, yoga) and older check-ins.
 */
export const ACTIVITIES: { key: ActivityKey; emoji: string; label: string; hint: string; kind: ActivityKind }[] = [
  { key: "steps", emoji: "🚶", label: "Stappen", hint: "Doel: 70.000 per week", kind: "steps" },
  { key: "hydration", emoji: "💧", label: "Water", hint: "2,5 tot 3 liter", kind: "daily" },
  { key: "nutrition", emoji: "🥑", label: "Whole foods", hint: "Vooral onbewerkt gegeten", kind: "daily" },
  { key: "protein", emoji: "🍳", label: "Genoeg eiwit", hint: "Eiwit bij elke hoofdmaaltijd", kind: "daily" },
  { key: "recovery", emoji: "😴", label: "7 tot 9 uur slaap", hint: "Vast ritme, weinig scherm", kind: "daily" },
  { key: "alcohol", emoji: "🍷", label: "Geen alcohol", hint: "Of zet een joker in", kind: "daily" },
  { key: "run", emoji: "🏃", label: "Hardlopen", hint: "Doel: 3 keer per week", kind: "weekly" },
  { key: "strength", emoji: "🏋️", label: "Krachttraining", hint: "Doel: 3 keer per week", kind: "weekly" },
  { key: "moved", emoji: "🚴", label: "Andere training", hint: "Wandelen, fietsen, yoga", kind: "extra" },
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

export const RECIPE_CATEGORIES = ["Ontbijt", "Middageten", "Avondeten", "Tussendoortje"] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

/** Label shown on the filter chips (plural for snacks). */
export const RECIPE_CATEGORY_LABELS: Record<RecipeCategory, string> = {
  Ontbijt: "Ontbijt",
  Middageten: "Middageten",
  Avondeten: "Avondeten",
  Tussendoortje: "Tussendoortjes",
};

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
    body: "Richtlijn: 70.000 stappen per week, zo'n 10.000 per dag. Een rustige dag haal je later in de week in. Wandelen en gewoon bewegen tellen volop mee.",
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
    body: "Mik op een alcoholvrije challenge, met twee jokers voor een bewust uitzonderingsmoment. Zet je een joker in, dan ziet de squad dat.",
  },
] as const;
