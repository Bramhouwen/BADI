/**
 * A one-off announcement: a character walks in once for every member and
 * says something. The admin first tries it on their own phone, then sends
 * it: Baddy posts it in the squad chat with a push, and from then on everyone
 * sees the character once when they open the app. Whether it was sent is read
 * from that chat message, so no extra table is needed.
 */
export const ANNOUNCEMENT = {
  id: "poppetje-anne",
  /** First name of the character that speaks. */
  sprite: "anne",
  greeting: "Jongens!",
  line: "Ik wil me even voorstellen. Ik ben Anne, het eerste poppetje van BADI. Jullie krijgen allemaal een melding zodra dat van jullie er is.",
  /** The big announcement screen. */
  label: "Nieuw in BADI",
  title: "Maak kennis met Anne",
  intro: "Iedereen krijgt een eigen poppetje. Dit doet jouw poppetje voor je:",
  features: [
    { icon: "👋", title: "Elke dag een begroeting", body: "Bij het openen van de app hoor je wat er vandaag voor je klaarstaat: stappen, je check-in, het Weekrad of een nieuw bericht." },
    { icon: "🏠", title: "Altijd op Home", body: "Je poppetje laat zien hoe je dag gaat: slapen, bezig of alles gedaan. Tik erop voor je bericht van vandaag." },
    { icon: "🎉", title: "Viert mee", body: "Alles afgevinkt, je stappendoel gehaald, een training of een week op rij: je poppetje gaat los." },
    { icon: "💬", title: "Brengt berichten", body: "Stuurt iemand je een bericht, dan loopt diens poppetje binnen. Tik erop en de chat gaat open." },
  ],
  cta: "Leuk, Anne!",
  /** Baddy's message in the squad chat; also the marker that it was sent. */
  chat: "👋 Nieuw in BADI: jullie eigen poppetje! Anne is de eerste. Open de app en ze stelt zich even voor. Jullie krijgen een melding zodra jouw poppetje er is.",
  push: { title: "Anne stelt zich voor 👋", body: "Jullie eigen poppetje is er! Anne is de eerste. Open de app en maak kennis." },
} as const;

/** Query string that shows the announcement on this device, also before it was sent. */
export const ANNOUNCEMENT_PREVIEW = "aankondiging";

/** Shows a member's own introduction on this device (admin only): /?poppetje=<name>. */
export const OWN_SPRITE_PREVIEW = "poppetje";

/** What a member sees once when the admin released their own character. */
export function ownSpriteIntro(name: string) {
  return {
    greeting: `Hoi ${name}!`,
    line: "Ik ben jouw eigen poppetje. Vanaf nu sta ik op Home, zeg ik je elke dag gedag en vier ik mee als je iets haalt.",
    label: "Nieuw voor jou",
    title: `Hier is je poppetje, ${name}!`,
    intro: "Dit doe ik voor je:",
    features: [
      { icon: "👋", title: "Elke dag een begroeting", body: "Als je de app opent, vertel ik wat er vandaag voor je klaarstaat." },
      { icon: "🏠", title: "Altijd op Home", body: "Aan mij zie je hoe je dag gaat. Tik op me voor je bericht van vandaag." },
      { icon: "🎉", title: "Ik vier mee", body: "Alles afgevinkt, je stappendoel, een training of een week op rij: ik ga los." },
      { icon: "💬", title: "Ik breng je berichten", body: "Stuur je iemand een bericht, dan loop ik bij diegene binnen." },
    ],
    cta: "Leuk, laten we gaan!",
    push: { title: "Je poppetje is er! 🎉", body: "Open BADI en maak kennis met je eigen poppetje." },
  };
}
