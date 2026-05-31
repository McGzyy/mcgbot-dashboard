/** Tailwind classes for a brief queue-row highlight flash. */
export const MOD_QUEUE_HIGHLIGHT_RING =
  "ring-2 ring-violet-400/70 bg-violet-500/10 transition-[box-shadow,background-color] duration-300";

export function queueHighlightKeysMatch(a: string, b: string): boolean {
  const left = a.trim();
  const right = b.trim();
  if (!left || !right) return false;
  return left === right || left.toLowerCase() === right.toLowerCase();
}

/** Append `?highlight=` (or `&highlight=`) before any hash fragment. */
export function appendHighlightQuery(href: string, subjectId: string): string {
  const id = subjectId.trim();
  if (!id) return href;
  const enc = encodeURIComponent(id);
  const hashIdx = href.indexOf("#");
  const base = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const hash = hashIdx >= 0 ? href.slice(hashIdx) : "";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}highlight=${enc}${hash}`;
}

export function modQueueHighlightRing(active: boolean): string {
  return active ? MOD_QUEUE_HIGHLIGHT_RING : "";
}
