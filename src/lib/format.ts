export function formatMl(ml: number): string {
  return `${new Intl.NumberFormat("nl-NL").format(ml)} ml`;
}
