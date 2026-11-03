/**
 * Baddy proposes first and saves only after a yes. She ends a proposal with one of these
 * questions; the coach chat then shows a one-tap answer that sends the matching confirmation.
 */
export const OFFERS = {
  recipe: { question: "Zal ik hem in de Kitchen zetten?", questionMany: "Welke zal ik in de Kitchen zetten?", confirm: "Ja, zet hem in de Kitchen", label: "Ja, zet in Kitchen" },
  plan: { question: "Zal ik dit schema in Fitness zetten?", confirm: "Ja, zet het schema in Fitness", label: "Ja, zet in Fitness" },
} as const;

export type OfferKind = keyof typeof OFFERS;

/** Which save Baddy is offering at the end of a reply, if any. A question about several recipes needs a typed choice, so it gets no button. */
export function saveOffer(text: string): OfferKind | null {
  const tail = text.trim().split("\n").pop()?.trim().toLowerCase() ?? "";
  if (!tail.endsWith("?")) return null;
  if (tail.includes("welke")) return null;
  if (/\bkitchen\b/.test(tail)) return "recipe";
  if (/\bfitness\b/.test(tail)) return "plan";
  return null;
}
