import { describe, expect, it } from "vitest";
import { CHAT_LINE_SECONDS, CHAT_MAX_LINES, lineAlpha, liveLines, placeBalloon, pushLine, stackTops, type ChatLine } from "@/lib/world/engine/chat-strip";
import { appendLog, roomLog, LOG_MAX, ROOM_LOG_LINES, type LoggedLine } from "@/lib/world/chat-log";

const line = (id: number, at: number): ChatLine => ({ id, from: "a", name: "Sam", text: `regel ${id}`, at, x: null, y: null });

describe("gespreksstrook", () => {
  it("houdt de nieuwste regels en laat de oudste vallen", () => {
    let lines: ChatLine[] = [];
    for (let i = 1; i <= CHAT_MAX_LINES + 2; i++) lines = pushLine(lines, line(i, i));
    expect(lines).toHaveLength(CHAT_MAX_LINES);
    expect(lines[0].id).toBe(3);
    expect(lines.at(-1)!.id).toBe(CHAT_MAX_LINES + 2);
  });

  it("laat een regel na de tijd verdwijnen en vervaagt hem aan het eind", () => {
    const l = line(1, 0);
    const end = CHAT_LINE_SECONDS * 1000;
    expect(liveLines([l], end - 1)).toHaveLength(1);
    expect(liveLines([l], end)).toHaveLength(0);
    expect(lineAlpha(l, 1000)).toBe(1);
    expect(lineAlpha(l, end - 300)).toBeCloseTo(0.5);
  });

  it("zet de nieuwste onderaan en de oudere erboven", () => {
    expect(stackTops([40, 58, 40], 200, 6)).toEqual([200 - 40 - 6 - 58 - 6 - 40, 200 - 40 - 6 - 58, 160]);
  });

  it("zet de ballon boven de spreker, binnen beeld, met een pijltje als die buiten beeld is", () => {
    expect(placeBalloon(200, 100, 400)).toEqual({ x: 150, side: null });
    expect(placeBalloon(5, 100, 400)).toEqual({ x: 10, side: null });
    expect(placeBalloon(-50, 100, 400)).toEqual({ x: 10, side: "left" });
    expect(placeBalloon(900, 100, 400)).toEqual({ x: 290, side: "right" });
    expect(placeBalloon(null, 100, 400)).toEqual({ x: 150, side: null });
  });
});

describe("gesprek terugkijken", () => {
  const said = (scene: string, at: number): LoggedLine => ({ from: "a", name: "Sam", scene, text: `t${at}`, at });

  it("toont alleen de laatste regels van deze ruimte", () => {
    let log: LoggedLine[] = [];
    for (let i = 0; i < 40; i++) log = appendLog(log, said(i % 2 ? "woonkamer" : "buiten", i));
    const room = roomLog(log, "woonkamer");
    expect(room).toHaveLength(Math.min(20, ROOM_LOG_LINES));
    expect(room.every((l) => l.scene === "woonkamer")).toBe(true);
    expect(room.at(-1)!.at).toBe(39);
  });

  it("bewaart niet meer dan het maximum", () => {
    let log: LoggedLine[] = [];
    for (let i = 0; i < LOG_MAX + 10; i++) log = appendLog(log, said("woonkamer", i));
    expect(log).toHaveLength(LOG_MAX);
    expect(log[0].at).toBe(10);
  });
});
