import { RECIPE_CATEGORIES, type RecipeCategory } from "@/lib/constants";

/** An imported recipe, ready to prefill the recipe form. Fields stay empty when the source does not have them. */
export interface RecipeDraft {
  title: string;
  description: string;
  ingredients: string;
  instructions: string;
  category: RecipeCategory | "";
  protein_grams: number | null;
  source_url: string | null;
}

export const IMPORT_TEXT_MAX = 8000;

/** The first http(s) link in a piece of text, for example a TikTok share message. */
export function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[).,!?]+$/, "") : null;
}

/** A public web address the server may fetch, or null. Blocks local and private hosts. */
export function publicUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return null;
  // IP addresses are never needed for a recipe site.
  if (/^[\d.]+$/.test(host) || host.startsWith("[")) return null;
  return url;
}

export function isTikTok(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return host === "tiktok.com" || host.endsWith(".tiktok.com");
}

/**
 * The caption of a TikTok video from its page: TikTok sends the video data
 * along as JSON. oEmbed no longer includes the caption.
 */
export function tiktokDescFromHtml(html: string): string {
  const m = html.match(/<script[^>]*id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (m) {
    try {
      const data = JSON.parse(m[1]) as { __DEFAULT_SCOPE__?: Record<string, { itemInfo?: { itemStruct?: { desc?: unknown } } }> };
      const desc = data.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct?.desc;
      if (typeof desc === "string" && desc.trim()) return desc.trim();
    } catch {}
  }
  // Older page layout: the first "desc" string anywhere in the page data.
  const loose = html.match(/"desc":("(?:[^"\\]|\\.)*")/);
  if (loose) {
    try {
      return String(JSON.parse(loose[1])).trim();
    } catch {}
  }
  return "";
}

/** Readable site name for the source line, for example "leukerecepten.nl". */
export function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^(www|m|vm)\./, "");
  } catch {
    return url;
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

function clean(s: unknown): string {
  if (typeof s !== "string") return "";
  return decodeEntities(s.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

type Json = Record<string, unknown>;

function isRecipe(node: Json): boolean {
  const t = node["@type"];
  return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
}

function findRecipe(node: unknown, depth = 0): Json | null {
  if (!node || typeof node !== "object" || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n, depth + 1);
      if (r) return r;
    }
    return null;
  }
  const obj = node as Json;
  if (isRecipe(obj)) return obj;
  for (const key of ["@graph", "mainEntity", "itemListElement"]) {
    const r = findRecipe(obj[key], depth + 1);
    if (r) return r;
  }
  return null;
}

function steps(node: unknown): string[] {
  if (typeof node === "string") {
    return node
      .split(/\n+/)
      .map(clean)
      .filter(Boolean);
  }
  if (Array.isArray(node)) return node.flatMap(steps);
  if (node && typeof node === "object") {
    const obj = node as Json;
    if (obj.itemListElement) return steps(obj.itemListElement);
    const text = clean(obj.text) || clean(obj.name);
    return text ? [text] : [];
  }
  return [];
}

const CATEGORY_WORDS: [RecipeCategory, RegExp][] = [
  ["Ontbijt", /\b(ontbijt|breakfast|brunch)/i],
  ["Tussendoortje", /\b(snack|tussendoor|borrel|dessert|toetje)/i],
  ["Middageten", /\b(lunch|middageten)/i],
  ["Avondeten", /\b(diner|dinner|hoofdgerecht|avondeten|main course)/i],
];

export function categoryFrom(...texts: unknown[]): RecipeCategory | "" {
  const hay = texts
    .flat()
    .filter((t): t is string => typeof t === "string")
    .join(" ");
  for (const [cat, re] of CATEGORY_WORDS) if (re.test(hay)) return cat;
  return "";
}

function proteinFrom(nutrition: unknown): number | null {
  const raw = nutrition && typeof nutrition === "object" ? (nutrition as Json).proteinContent : null;
  const m = typeof raw === "string" ? raw.match(/(\d+(?:[.,]\d+)?)/) : typeof raw === "number" ? [String(raw), String(raw)] : null;
  if (!m) return null;
  const n = Math.round(Number(m[1].replace(",", ".")));
  return Number.isFinite(n) && n >= 0 && n <= 300 ? n : null;
}

/**
 * The recipe a page publishes as schema.org data (most recipe sites do, for
 * Google). Taken over as it is, without AI, so nothing gets made up.
 */
export function recipeFromHtml(html: string, sourceUrl: string): RecipeDraft | null {
  const blocks = html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const r = findRecipe(data);
    if (!r) continue;
    // Some sites nest the list once more ([[...]]) or give one string per line.
    const ingredients = [r.recipeIngredient ?? r.ingredients]
      .flat(3)
      .flatMap((i) => (typeof i === "string" ? i.split(/\n+/) : []))
      .map(clean)
      .filter(Boolean);
    const instructions = steps(r.recipeInstructions);
    const title = clean(r.name);
    if (!title && ingredients.length === 0) continue;
    return {
      title: title.slice(0, 80),
      description: clean(r.description).slice(0, 500),
      ingredients: ingredients.join("\n").slice(0, 2000),
      instructions: instructions.map((s, i) => `${i + 1}. ${s}`).join("\n").slice(0, 4000),
      category: categoryFrom(r.recipeCategory, r.keywords, title),
      protein_grams: proteinFrom(r.nutrition),
      source_url: sourceUrl,
    };
  }
  return null;
}

/** Visible text of a page (title, description, body), for reading by AI when it has no recipe data. */
export function pageText(html: string): string {
  const meta = (name: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] ?? "";
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html)
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|p|li|h\d|div|tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = [clean(title), clean(meta("og:description") || meta("description")), decodeEntities(body)]
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return text.slice(0, IMPORT_TEXT_MAX);
}

/** What the AI returns when it reads a text or screenshot. */
export interface ReadRecipe {
  found: boolean;
  title?: string;
  description?: string;
  category?: string;
  ingredients?: string[];
  instructions?: string[];
  protein_grams?: number | null;
}

/** Turns what the AI read into a form draft; null when there was no recipe in it. */
export function draftFromRead(r: ReadRecipe, sourceUrl: string | null): RecipeDraft | null {
  const ingredients = (r.ingredients ?? []).map((s) => clean(s)).filter(Boolean);
  const instructions = (r.instructions ?? []).map((s) => clean(s).replace(/^\d+[.)]\s*/, "")).filter(Boolean);
  if (!r.found || (ingredients.length === 0 && instructions.length === 0)) return null;
  const category = (RECIPE_CATEGORIES as readonly string[]).includes(r.category ?? "") ? (r.category as RecipeCategory) : "";
  const protein = typeof r.protein_grams === "number" && Number.isInteger(r.protein_grams) && r.protein_grams >= 0 && r.protein_grams <= 300 ? r.protein_grams : null;
  return {
    title: clean(r.title).slice(0, 80),
    description: clean(r.description).slice(0, 500),
    ingredients: ingredients.join("\n").slice(0, 2000),
    instructions: instructions.map((s, i) => `${i + 1}. ${s}`).join("\n").slice(0, 4000),
    category,
    protein_grams: protein,
    source_url: sourceUrl,
  };
}
