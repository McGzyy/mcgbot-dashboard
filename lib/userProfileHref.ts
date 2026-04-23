/**
 * Canonical dashboard profile URL: always use the Discord snowflake.
 * Display names (especially with emoji / special Unicode) break URL resolution and
 * `resolveDiscordIdFromProfileRouteParam` lookups; the `/user/[id]` API expects a stable id.
 */
export function userProfileHref(opts: {
  discordId: string;
  displayName?: string | null;
}): string {
  const id = (opts.discordId ?? "").trim();
  if (!id) return "/";
  return `/user/${encodeURIComponent(id)}`;
}

/** Active nav / pathname check when profile URLs may use either id or display name. */
export function userProfilePathMatches(
  pathname: string | null | undefined,
  discordId: string,
  displayName?: string | null
): boolean {
  if (!pathname?.startsWith("/user/")) return false;
  const raw = pathname.slice("/user/".length).split("/")[0] ?? "";
  let rest = raw;
  try {
    rest = decodeURIComponent(raw);
  } catch {
    rest = raw;
  }
  if (!rest) return false;
  const id = discordId.trim();
  const dn = (displayName ?? "").trim();
  if (rest === id) return true;
  if (dn && rest === dn) return true;
  if (dn && rest.toLowerCase() === dn.toLowerCase()) return true;
  return false;
}
