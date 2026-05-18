/** Base URL for the affiliate portal (optional dedicated host, e.g. https://partners.mcgbot.xyz). */
export function affiliatePortalOrigin(): string {
  const dedicated = process.env.NEXT_PUBLIC_AFFILIATE_PORTAL_URL?.trim();
  if (dedicated) {
    try {
      return new URL(dedicated).origin;
    } catch {
      /* fall through */
    }
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "";
  if (site) {
    try {
      return new URL(site).origin;
    } catch {
      /* fall through */
    }
  }
  return "";
}

export function affiliatePortalPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const origin = affiliatePortalOrigin();
  return origin ? `${origin.replace(/\/$/, "")}${p}` : p;
}
