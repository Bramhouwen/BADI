import { Fragment, type ReactNode } from "react";

/** **bold** inside a line; everything else stays plain text (no HTML is ever injected). */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul"; items: string[] } | { kind: "ol"; items: string[] };

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (!line.trim()) {
      blocks.push({ kind: "p", lines: [] });
    } else if (bullet) {
      if (last?.kind === "ul") last.items.push(bullet[1]);
      else blocks.push({ kind: "ul", items: [bullet[1]] });
    } else if (numbered) {
      if (last?.kind === "ol") last.items.push(numbered[1]);
      else blocks.push({ kind: "ol", items: [numbered[1]] });
    } else {
      const heading = /^#{1,4}\s+(.*)$/.exec(line);
      const content = heading ? `**${heading[1]}**` : line;
      if (last?.kind === "p" && last.lines.length) last.lines.push(content);
      else blocks.push({ kind: "p", lines: [content] });
    }
  }
  return blocks.filter((b) => (b.kind === "p" ? b.lines.length > 0 : b.items.length > 0));
}

/** Minimal, safe rendering of Baddy's replies: paragraphs, bullet and numbered lists, bold. */
export function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {parseBlocks(text).map((b, i) =>
        b.kind === "p" ? (
          <p key={i} className="whitespace-pre-wrap break-words">
            {b.lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 ? <br /> : null}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        ) : b.kind === "ul" ? (
          <ul key={i} className="space-y-1 pl-1">
            {b.items.map((it, ii) => (
              <li key={ii} className="flex gap-2">
                <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" aria-hidden />
                <span className="min-w-0 break-words">{inline(it)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="space-y-1 pl-1">
            {b.items.map((it, ii) => (
              <li key={ii} className="flex gap-2">
                <span className="shrink-0 tabular-nums opacity-60">{ii + 1}.</span>
                <span className="min-w-0 break-words">{inline(it)}</span>
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
