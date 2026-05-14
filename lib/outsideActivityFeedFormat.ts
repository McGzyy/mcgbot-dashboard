const FIELD_SEP = "|||";

/**
 * Machine-parseable prefix for outside X monitor rows in Live Activity (`/api/activity`).
 * Tape label is URI-encoded so it cannot collide with `FIELD_SEP`.
 */
export const OUTSIDE_ACTIVITY_TEXT_PREFIX = "outside:";

export function buildOutsideActivityLineText(input: {
  tapeLabel: string;
  xHandle: string;
  mint: string;
}): string {
  const tape = (input.tapeLabel || "").trim() || "Monitor";
  const handle = (input.xHandle || "").trim().replace(/\|/g, "");
  const mint = (input.mint || "").trim();
  return `${OUTSIDE_ACTIVITY_TEXT_PREFIX}${encodeURIComponent(tape)}${FIELD_SEP}${handle}${FIELD_SEP}${mint}`;
}

export function parseOutsideActivityLineText(
  text: string
): { tapeLabel: string; xHandle: string; mint: string } | null {
  if (!text.startsWith(OUTSIDE_ACTIVITY_TEXT_PREFIX)) return null;
  const body = text.slice(OUTSIDE_ACTIVITY_TEXT_PREFIX.length);
  const i = body.indexOf(FIELD_SEP);
  if (i === -1) return null;
  const tapeEnc = body.slice(0, i);
  const rest = body.slice(i + FIELD_SEP.length);
  const j = rest.indexOf(FIELD_SEP);
  if (j === -1) return null;
  const handle = rest.slice(0, j);
  const mint = rest.slice(j + FIELD_SEP.length).trim();
  if (!mint) return null;
  let tapeLabel = tapeEnc;
  try {
    tapeLabel = decodeURIComponent(tapeEnc);
  } catch {
    // keep encoded fragment
  }
  return { tapeLabel, xHandle: handle, mint };
}
