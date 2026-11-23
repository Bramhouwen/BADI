/**
 * In-app links inside chat messages: a path like /wheel/prizes (or the full
 * badi-mu.vercel.app address) becomes a tap-able chip under the bubble, and is
 * left out of the bubble text itself.
 */
const APP_PATH = /(^|\s)(?:https:\/\/badi-mu\.vercel\.app)?(\/(?:wheel|kitchen|wall|squad|checkin|fitness|dashboard|profile|water|coach)(?:\/[A-Za-z0-9_-]+)*)(?=[\s.,!?)]|$)/g;

const LABELS: [RegExp, string][] = [
  [/^\/wheel\/prizes/, "Naar je prijzenkast"],
  [/^\/wheel/, "Naar het Weekrad"],
  [/^\/kitchen/, "Naar de Kitchen"],
  [/^\/wall/, "Naar de Wall"],
  [/^\/checkin/, "Naar je check-in"],
  [/^\/fitness/, "Naar Fitness"],
  [/^\/squad/, "Naar de squad"],
];

export interface AppLink {
  href: string;
  label: string;
}

/** The body without app links, and the links found in it (each path once). */
export function extractAppLinks(body: string): { text: string; links: AppLink[] } {
  const links: AppLink[] = [];
  const text = body
    .replace(APP_PATH, (_m, lead: string, path: string) => {
      if (!links.some((l) => l.href === path)) links.push({ href: path, label: LABELS.find(([re]) => re.test(path))?.[1] ?? "Openen" });
      return lead;
    })
    .replace(/[ \t]+([.,!?])/g, "$1")
    .replace(/:\s*([.,!?]|$)/gm, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return { text, links };
}
