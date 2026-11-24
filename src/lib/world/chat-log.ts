/**
 * What was said in the rooms of World of Badi during this visit, to read back.
 * Speech goes over the live link and is never stored on the server, so this
 * only holds what came in while you had the world open. It is kept on the
 * device for the rest of the session, also when you reload the page.
 */

export interface LoggedLine {
  from: string;
  name: string;
  scene: string;
  text: string;
  /** Date.now() when it came in. */
  at: number;
}

/** Lines kept in total, over all rooms. */
export const LOG_MAX = 100;
/** Lines shown for one room. */
export const ROOM_LOG_LINES = 30;

export const chatLogKey = (userId: string) => `wereld-gesprek:${userId}`;

export function appendLog(list: readonly LoggedLine[], line: LoggedLine, max = LOG_MAX): LoggedLine[] {
  return [...list, line].slice(-max);
}

/** The last lines said in one room, oldest first. */
export function roomLog(list: readonly LoggedLine[], scene: string, n = ROOM_LOG_LINES): LoggedLine[] {
  return list.filter((l) => l.scene === scene).slice(-n);
}

const isLine = (v: unknown): v is LoggedLine => {
  const r = v as Record<string, unknown> | null;
  return Boolean(r) && typeof r!.from === "string" && typeof r!.name === "string" && typeof r!.scene === "string" && typeof r!.text === "string" && typeof r!.at === "number";
};

export function readLog(userId: string): LoggedLine[] {
  try {
    const raw = sessionStorage.getItem(chatLogKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isLine).slice(-LOG_MAX) : [];
  } catch {
    return [];
  }
}

export function saveLog(userId: string, list: readonly LoggedLine[]) {
  try {
    sessionStorage.setItem(chatLogKey(userId), JSON.stringify(list.slice(-LOG_MAX)));
  } catch {
    // no storage (private window): the log lives until the page closes
  }
}

/** Clock time of a line, like 14:05. */
export function clockOf(at: number): string {
  return new Date(at).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}
