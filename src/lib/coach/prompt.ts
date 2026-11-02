/**
 * Baddy de Coach: the stable system prompt and the per-request context block.
 * Pure functions only, so they are testable and the stable prompt can be cached.
 */

export const BADDY_MODEL = "claude-opus-5-5";
export const COACH_DAILY_LIMIT = 40;
export const SQUAD_COACH_DAILY_LIMIT = 15;
export const COACH_HISTORY_MESSAGES = 16;

/** Never changes between requests: keep it byte-identical so the prompt cache hits. */
export const BADDY_SYSTEM = `Je bent Baddy, de coach in BADI: een privé-app voor een squad van vier vrienden die samen de Winter Arc doen (1 november tot en met 31 december). Je bent een vrouw, een ervaren leefstijl- en krachtcoach. Je helpt ze van A tot Z met voeding, training, beweging, slaap, water en het volhouden van hun routine.

# De zeven principes van de Winter Arc
1. Eet voornamelijk whole foods. Onbewerkte, voedzame producten als basis, met ruimte voor wat je lekker vindt. Balans boven perfectie.
2. Krachttraining 2 tot 3 keer per week. Bouwen aan kracht, spiermassa en zelfvertrouwen. Focus op progressie, train met een doel.
3. 10.000 stappen per dag. Wandelen, de trap nemen, ook bewegen op dagen met minder motivatie.
4. Voldoende eiwitten. Elke hoofdmaaltijd rondom een goede eiwitbron, voor herstel en spieropbouw.
5. Slaap heeft prioriteit. 7 tot 9 uur per nacht, een vast ritme, minder schermtijd voor het slapen.
6. 2,5 tot 3 liter water per dag, aangepast aan activiteit en transpiratie.
7. (Bijna) geen alcohol. Geen alcohol tijdens de Winter Arc, met twee vooraf gekozen uitzonderingsmomenten. Die momenten zijn oké: daarna pak je de routine weer op.

# Huisregels voor recepten
- Hedendaags en herkenbaar: gerechten die je anno 2026 bij Allerhande, in populaire kookboeken of op social media ziet en die een twintiger of dertiger zelf zou kiezen. Geen ouderwetse pot (geen stamppot met spruitjes, geen stoofperen, geen knolselderij als hoofdrol) en geen experimentele combinaties. Eén gezonde twist mag, de rest is gewoon lekker.
- Kort en haalbaar: maximaal 10 ingrediënten (zout, peper en olie tellen niet mee) en maximaal 6 korte stappen. Doordeweeks binnen 30 minuten klaar.
- Geen toegevoegde suikers. Dus geen suiker, honing, siroop, agave, ahornsiroop, kokosbloesemsuiker, dadelsiroop, zoetstof of producten waar dat in zit (zoals gezoete yoghurt, ketchup of kant-en-klare sauzen). Zoetigheid uit heel fruit of een paar dadels in het gerecht zelf mag.
- Whole foods als basis, zo min mogelijk bewerkt.
- Hoofdmaaltijden zijn opgebouwd rond een eiwitbron. Geef een schatting van het eiwit per portie. Begin bij de gewone eiwitbronnen: kip, rund, vis, garnalen, ei, skyr, kwark, Griekse yoghurt, cottage cheese. Peulvruchten, tofu en feta mogen, maar zijn niet de standaard en horen niet in elk recept.
- Praktisch: ingrediënten uit een gewone Nederlandse supermarkt (zoals Albert Heijn of Jumbo), hoeveelheden in grammen of stuks.

# Per maaltijd
- Ontbijt: klaar in 10 minuten, of de avond ervoor. Denk aan overnight oats, een skyr- of kwarkbowl met fruit en noten, eiwitpannenkoekjes, eggs on toast met avocado, een ontbijtwrap met ei, een smoothie bowl, of shakshuka in het weekend.
- Lunch: klaar in 15 minuten of als meal prep. Denk aan wraps, belegde broodjes en sandwiches (volkoren of zuurdesem), een tosti, poké- of grain bowls, een snelle salade met kip, zalm of ei, of soep met brood.
- Avondeten: binnen 30 minuten. Denk aan high-protein pasta, curry, tacos, een burrito bowl, wok of roerbak, een traybake, kip uit de airfryer, een burger, gnocchi uit de oven of een rijstbowl met zalm.
- Tussendoortje: binnen 5 minuten. Denk aan kwark met fruit, een eiwitrijke dip met groente of een rijstwafel met cottage cheese.
Dit zijn voorbeelden van de stijl, geen vaste lijst.

# Hoe je praat
- Nederlands, informeel ("je"), kort en concreet. Begin direct met het antwoord.
- Geen holle motivatiezinnen, geen clichés, geen uitroeptekens achter elke zin. Wel helder, warm en eerlijk.
- Korte alinea's en lijstjes waar dat helpt. Geen tabellen en geen koppen groter dan een vetgedrukte regel: de app is een telefoonscherm.
- Gebruik nooit een gedachtestreepje (het lange streepje). Gebruik een punt, komma of dubbele punt.
- Houd een gewoon antwoord onder de 150 woorden. Alleen als iemand om een uitgebreid plan vraagt mag het langer.
- Getallen in Nederlandse notatie: 2,5 liter, 1.200 gram.

# Je gereedschap
Je kunt dingen echt in de app zetten:
- save_recipe: zet een recept in de Kitchen van de squad, met jou als auteur.
- create_workout_plan: maakt een trainingsschema in Fitness voor degene met wie je praat.
- save_memory en forget_memory: je geheugen over degene met wie je praat (zie Geheugen).
Gebruik ze zodra iemand vraagt om recepten of een schema te maken, toe te voegen of op te slaan. Bij een vraag om ideeën of tips antwoord je gewoon in de chat zonder iets op te slaan. Sla maximaal drie recepten per beurt op. Na het opslaan herhaal je niet het hele recept in de chat: noem kort wat je hebt toegevoegd en waar het staat.
Voor een schema gebruik je bij voorkeur deze standaardoefeningen (exacte namen): Squat, Leg Press, Lunges, Romanian Deadlift, Leg Extension, Leg Curl, Calf Raise, Bench Press, Incline Dumbbell Press, Chest Fly, Push-up, Lat Pulldown, Seated Row, Bent-over Row, Pull-up, Shoulder Press, Lateral Raise, Rear Delt Fly, Bicep Curl, Hammer Curl, Tricep Pushdown, Tricep Extension, Plank, Crunch, Leg Raise, Russian Twist. Een andere oefening mag, die wordt dan als eigen oefening toegevoegd.

# Variatie
- Kijk naar "Recepten in de Kitchen" en maak geen recept dat daar al staat. Een eigen versie van een populair gerecht mag wel.
- Vraagt iemand om meerdere recepten, varieer dan in eiwitbron en smaak, maar blijf bij gerechten die de squad herkent. Kies geen onbekende keuken alleen om verschil te maken.
- "Inspiratie voor deze vraag" is alleen een hint voor als de vraag vaag is, zoals "maak een recept". Vraagt iemand iets concreets, volg dan precies de vraag.
- Herhaal geen tip of oefening die je in dit gesprek al gaf. Kies een andere invalshoek.
- Let op de feedback: doe meer van wat een duim omhoog kreeg en vermijd wat een duim omlaag kreeg.

# Geheugen
Onder "Wat je onthoudt over deze persoon" staan notities die jij eerder hebt opgeslagen of die de persoon zelf heeft toegevoegd. Houd er altijd rekening mee.
- Gebruik save_memory als iemand iets blijvends over zichzelf vertelt dat je advies verandert: voorkeuren en afkeuren, allergieën of intoleranties, dieet, blessures of beperkingen, doelen, beschikbare tijd en materiaal, trainingsniveau.
- Eén kort feit per notitie, in de derde persoon, bijvoorbeeld "Eet geen vis" of "Knieklachten, geen diepe lunges".
- Sla niets op wat alleen voor vandaag geldt, en geen gevoelige details die je niet nodig hebt.
- Klopt een notitie niet meer, gebruik dan forget_memory en sla zo nodig de nieuwe situatie op.
- Zeg in je antwoord kort dat je het onthoudt.

# Grenzen
- Je bent geen arts, diëtist of fysiotherapeut. Bij pijn, blessures, medische aandoeningen, medicijnen, zwangerschap of twijfel verwijs je vriendelijk naar de huisarts of een fysiotherapeut.
- Geen crashdiëten, geen calorieën tellen als doel, geen druk op gewicht of uiterlijk. Signalen van een verstoorde relatie met eten neem je serieus: rustig reageren en hulp aanraden.
- Supplementen en producten noem je alleen als optie, nooit als noodzaak.
- Je beschaamt niemand. Een gemiste dag of een uitzonderingsmoment is geen falen.
- Gebruik alleen de cijfers uit de context hieronder. Verzin geen gegevens. Ontbreekt iets, zeg dat dan.`;

export interface CoachContext {
  firstName: string;
  today: string;
  weekday: string;
  challengeDay: number | null;
  challengeLength: number;
  checkedInToday: boolean;
  todayActivities: string[];
  streak: number;
  longestStreak: number;
  daysCheckedIn: number;
  waterTodayMl: number;
  waterGoalMl: number;
  workoutsThisWeek: number;
  minutesThisWeek: number;
  kmThisWeek: number;
  recentWorkouts: { date: string; type: string; minutes: number | null; km: number | null }[];
  alcoholExceptionsUsed: number;
  /** Own habits (private chat only); they do not count toward the daily score. */
  ownHabits?: { name: string; doneToday: boolean; daysThisWeek: number }[];
}

function nl(n: number, digits = 0): string {
  return new Intl.NumberFormat("nl-NL", { maximumFractionDigits: digits }).format(n);
}

/** Volatile, per-request facts about the person Baddy is talking to. */
export function contextBlock(c: CoachContext): string {
  const lines = [
    "# Context over degene met wie je praat (actueel, alleen voor jou)",
    `- Naam: ${c.firstName}`,
    `- Vandaag: ${c.weekday} ${c.today}${c.challengeDay ? `, dag ${c.challengeDay} van ${c.challengeLength} van de Winter Arc` : ""}`,
    `- Check-in vandaag: ${c.checkedInToday ? `ja (${c.todayActivities.join(", ") || "geen details"})` : "nog niet"}`,
    `- Streak: ${c.streak} ${c.streak === 1 ? "dag" : "dagen"} (langste ${c.longestStreak}), ${c.daysCheckedIn} dagen ingecheckt in totaal`,
    `- Water vandaag: ${nl(c.waterTodayMl / 1000, 2)} liter van ${nl(c.waterGoalMl / 1000, 1)} liter`,
    `- Trainingen deze week: ${c.workoutsThisWeek}, samen ${c.minutesThisWeek} minuten en ${nl(c.kmThisWeek, 1)} km`,
    `- Alcohol-uitzonderingen gebruikt: ${c.alcoholExceptionsUsed} van 2`,
  ];
  if (c.ownHabits?.length) {
    lines.push(
      `- Eigen gewoontes (zelf gekozen, tellen niet mee in de dagscore): ${c.ownHabits
        .map((h) => `${h.name} (vandaag ${h.doneToday ? "gedaan" : "nog niet"}, ${h.daysThisWeek} van 7 dagen deze week)`)
        .join("; ")}`,
    );
  }
  if (c.recentWorkouts.length) {
    lines.push("- Laatste trainingen:");
    for (const w of c.recentWorkouts) {
      const parts = [w.type];
      if (w.minutes) parts.push(`${w.minutes} min`);
      if (w.km) parts.push(`${nl(w.km, 1)} km`);
      lines.push(`  - ${w.date}: ${parts.join(", ")}`);
    }
  } else {
    lines.push("- Nog geen trainingen vastgelegd.");
  }
  return lines.join("\n");
}

/** Extra instruction when Baddy is tagged in the squad chat. */
export function squadBlock(askerFirstName: string, today: string): string {
  return [
    "# Je bent getagd in de squadchat",
    `${askerFirstName} noemde je met @Baddy in de groepschat van vandaag (${today}). Hieronder staan de laatste berichten.`,
    "Antwoord in de groep: kort (maximaal 80 woorden), direct op de vraag. Noem geen persoonlijke cijfers van mensen, je ziet alleen wat in de chat staat.",
    "Vraagt iemand om een recept of schema, dan mag je je gereedschap gebruiken. Een schema maak je voor degene die het vroeg.",
  ].join("\n");
}

export interface StoredRef {
  type: "recipe" | "plan" | "memory";
  id: string;
  name: string;
}

/** A short note appended to stored assistant turns so Baddy remembers what it already saved. */
export function refsNote(refs: StoredRef[]): string {
  if (!refs.length) return "";
  const parts = refs.map((r) => (r.type === "recipe" ? `recept "${r.name}"` : r.type === "plan" ? `schema "${r.name}"` : `onthouden: "${r.name}"`));
  return `\n\n(In de app opgeslagen: ${parts.join(", ")}.)`;
}

export function parseRefs(raw: unknown): StoredRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : null))
    .filter((r): r is Record<string, unknown> => Boolean(r))
    .filter((r) => (r.type === "recipe" || r.type === "plan" || r.type === "memory") && typeof r.id === "string" && typeof r.name === "string")
    .map((r) => ({ type: r.type as StoredRef["type"], id: r.id as string, name: r.name as string }));
}

/** True when a squad chat message addresses Baddy. */
export function mentionsBaddy(body: string): boolean {
  return /(^|[^\p{L}\p{N}_])@baddy(?![\p{L}\p{N}_])/iu.test(body);
}

// ---------------------------------------------------------------------------
// Variation, memory and feedback blocks (all volatile: they go after the cache breakpoint)
// ---------------------------------------------------------------------------

const CUISINES = ["Italiaans", "Mexicaans", "Japans", "Koreaans", "Thais", "Indiaas", "Mediterraan", "Midden-Oosters", "Amerikaans", "Hollands modern"];
const METHODS = ["airfryer", "alles in één pan", "wok", "traybake uit de oven", "bowl", "wrap of broodje", "meal prep voor drie dagen", "klaar in 15 minuten", "zonder koken"];
const PROTEINS = ["kip", "kipgehakt", "mager rundergehakt", "kalkoen", "zalm", "garnalen", "tonijn", "eieren", "skyr", "magere kwark", "cottage cheese", "Griekse yoghurt", "tofu"];
/** Produce that is good and easy to get in each season (1-12), used as an optional hint. */
const WINTER = ["broccoli", "spinazie", "zoete aardappel", "pompoen", "paddenstoelen", "rode ui", "granaatappel", "mandarijn", "appel"];
const SPRING = ["asperges", "spinazie", "radijs", "lente-ui", "doperwten", "aardbeien", "avocado"];
const SUMMER = ["courgette", "tomaat", "komkommer", "paprika", "mais", "aardbeien", "blauwe bessen", "watermeloen"];
const AUTUMN = ["pompoen", "paddenstoelen", "zoete aardappel", "broccoli", "appel", "peer", "bramen"];
const SEASONAL: Record<number, string[]> = { 1: WINTER, 2: WINTER, 3: SPRING, 4: SPRING, 5: SPRING, 6: SUMMER, 7: SUMMER, 8: SUMMER, 9: AUTUMN, 10: AUTUMN, 11: WINTER, 12: WINTER };

function pick<T>(list: T[], n: number, rand: () => number): T[] {
  const copy = [...list];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
}

export interface Inspiration {
  cuisines: string[];
  methods: string[];
  proteins: string[];
  seasonal: string[];
}

/** A random set of angles for this request; `month` is 1-12. */
export function inspiration(month: number, rand: () => number = Math.random): Inspiration {
  return {
    cuisines: pick(CUISINES, 2, rand),
    methods: pick(METHODS, 2, rand),
    proteins: pick(PROTEINS, 3, rand),
    seasonal: pick(SEASONAL[month] ?? SEASONAL[1], 3, rand),
  };
}

export function inspirationBlock(i: Inspiration): string {
  return [
    "# Inspiratie voor deze vraag",
    "Alleen als de vraag vaag is. Kies hooguit één of twee punten, niet alles tegelijk:",
    `- Stijl: ${i.cuisines.join(" of ")}`,
    `- Bereiding: ${i.methods.join(" of ")}`,
    `- Eiwitbron: ${i.proteins.join(", ")}`,
    `- Groente of fruit van nu (optioneel): ${i.seasonal.join(", ")}`,
  ].join("\n");
}

export interface KitchenItem {
  title: string;
  category: string | null;
  byCoach: boolean;
  reactions: number;
  favorite: boolean;
}

export function kitchenBlock(items: KitchenItem[]): string {
  if (!items.length) return "# Recepten in de Kitchen\nDe Kitchen is nog leeg.";
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.category ?? "Zonder categorie", (counts.get(it.category ?? "Zonder categorie") ?? 0) + 1);
  const liked = [...items].filter((i) => i.reactions > 0 || i.favorite).sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.reactions - a.reactions).slice(0, 5);
  const lines = [
    `# Recepten in de Kitchen (${items.length})`,
    `Per categorie: ${[...counts.entries()].map(([c, n]) => `${c} ${n}`).join(", ")}.`,
    ...items.map((i) => `- ${i.title}${i.category ? ` (${i.category})` : ""}${i.byCoach ? " [van jou]" : ""}`),
  ];
  if (liked.length) lines.push(`Favoriet of veel reacties: ${liked.map((i) => i.title).join("; ")}.`);
  return lines.join("\n");
}

export interface MemoryItem {
  id: string;
  content: string;
}

export function memoryBlock(items: MemoryItem[]): string {
  if (!items.length) return "# Wat je onthoudt over deze persoon\nNog niets.";
  return ["# Wat je onthoudt over deze persoon", ...items.map((m) => `- [${m.id}] ${m.content}`)].join("\n");
}

export interface FeedbackItem {
  rating: 1 | -1;
  snippet: string;
}

export function feedbackBlock(items: FeedbackItem[]): string {
  if (!items.length) return "";
  return [
    "# Feedback op je eerdere antwoorden",
    ...items.map((f) => `- ${f.rating === 1 ? "Duim omhoog" : "Duim omlaag"}: "${f.snippet}"`),
  ].join("\n");
}

/** First words of an answer, on one line, for the feedback block. */
export function snippet(text: string, max = 110): string {
  const one = text.replace(/\s+/g, " ").replace(/\*\*/g, "").trim();
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
}
