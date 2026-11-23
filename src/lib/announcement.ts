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
  /** Baddy's message in the squad chat; also the marker that it was sent. */
  chat: "👋 Nieuw in BADI: jullie eigen poppetje! Anne is de eerste. Open de app en ze stelt zich even voor. Jullie krijgen een melding zodra jouw poppetje er is.",
  push: { title: "Anne stelt zich voor 👋", body: "Jullie eigen poppetje is er! Anne is de eerste. Open de app en maak kennis." },
} as const;

/** Query string that shows the announcement on this device, also before it was sent. */
export const ANNOUNCEMENT_PREVIEW = "aankondiging";
