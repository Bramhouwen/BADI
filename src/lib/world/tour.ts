/**
 * The tour of World of Badi and the announcement that opens it. The admin
 * first sends a test push to their own phone, then sends it to everyone:
 * Baddy posts it in the squad chat and everyone else gets a push that opens
 * the world with the tour. Whether it was sent is read from that chat
 * message, so no extra table is needed.
 */

/** Query string that starts the tour: /wereld?rondleiding=1. */
export const TOUR_PARAM = "rondleiding";
export const TOUR_URL = `/wereld?${TOUR_PARAM}=1`;

/** Remembered on the device once you finished or skipped the tour. */
export const tourSeenKey = (userId: string) => `wereld-rondleiding:${userId}`;

export interface TourStep {
  title: string;
  body: string;
  /** The element to point at (data-tour attribute); none = a card in the middle. */
  target?: string;
  icon: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    icon: "🏡",
    title: "Welkom in World of Badi",
    body: "Jullie eigen dorp in BADI: het huis met de woonkamer en ieders eigen kamer, het dorp, Traffic Today en de sportschool. Je ziet live wie er is en wat die doet.",
  },
  {
    icon: "👆",
    title: "Lopen en zitten",
    body: "Tik op de vloer en je loopt erheen. Tik op een stoel of bank en je gaat zitten. Dubbeltik om in of uit te zoomen.",
  },
  {
    icon: "💬",
    title: "Zeg iets",
    body: "Typ hier en iedereen in dezelfde ruimte ziet het bovenin beeld, boven wie het zei. Met het knopje links kijk je het gesprek in deze ruimte terug.",
    target: "zeg",
  },
  {
    icon: "☕",
    title: "Wat ben je aan het doen?",
    body: "Kies je status: trainen, werken, chillen, koken of even weg. De anderen zien het icoontje boven je hoofd. Op Squad kies je hem al voor je naar binnen gaat.",
    target: "status",
  },
  {
    icon: "👋",
    title: "Doe iets",
    body: "Zwaai, juich of doe een dansje. Iedereen in de ruimte ziet het.",
    target: "acties",
  },
  {
    icon: "🗺️",
    title: "De kaart",
    body: "Ga naar een andere plek en zie wie waar is. Je kunt ook gewoon door een deur lopen.",
    target: "kaart",
  },
  {
    icon: "🙌",
    title: "Iemand aantikken",
    body: "Tik op iemand om te zwaaien, een high five te geven, mee te lopen of een bericht te sturen.",
  },
  {
    icon: "✉️",
    title: "Postvak",
    body: "Je berichten. Het zijn dezelfde chats als in de rest van de app.",
    target: "postvak",
  },
  {
    icon: "🪙",
    title: "Missies en munten",
    body: "Munten verdien je met wat je echt doet in BADI: 5 voor je check-in, 10 voor een training, 3 voor 2,5 liter water en 5 voor 10.000 stappen.",
    target: "munten",
  },
  {
    icon: "🛋️",
    title: "Je eigen kamer",
    body: "Koop meubels in de winkel en richt je kamer in. Bij een ander op bezoek laat je een briefje of high five achter; die krijgt er een melding van.",
  },
  {
    icon: "📍",
    title: "Altijd op Squad",
    body: "Op de Squad-pagina staat de kaart van World of Badi: wie waar is, je missies en je munten. Daar start je ook deze rondleiding opnieuw.",
  },
];

export const WORLD_TOUR = {
  /** Baddy's message in the squad chat; also the marker that it was sent. */
  chat: "🏡 Nieuw in BADI: World of Badi. Jullie eigen dorp: loop samen rond, laat zien wat je aan het doen bent, verdien munten en richt je eigen kamer in. De eerste keer krijg je een rondleiding: /wereld",
  push: { title: "World of Badi is open 🏡", body: "Jullie eigen dorp in BADI. Tik hier voor een rondleiding." },
} as const;
