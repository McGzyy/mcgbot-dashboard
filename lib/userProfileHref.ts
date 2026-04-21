/**
 * Canonical dashboard profile URL: prefer human display name (matches Discord capitalization)
 * when available; fall back to Discord id for deep links and bots without a stored name.
 */
export function userProfileHref(opts: {
  discordId: string;
  displayName?: string | null;
}): string {
  const id = (opts.discordId ?? "").trim();
  const dn = (opts.displayName ?? "").trim();
  if (!id) return "/";
  const syntheticFallback = /^User\s+[0-9a-z…]+/i.test(dn);
  const seg =
    dn &&
    !syntheticFallback &&
    dn.toLowerCase() !== "unknown"
      ? dn
      : id;
  return `/user/${encodeURIComponent(seg)}`;
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
