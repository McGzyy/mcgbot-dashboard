function hostnameFromEnvUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    return url.hostname;
  } catch {
    return null;
  }
}

/** Primary McGBot dashboard / member site host (not the affiliate-only subdomain). */
export function mainSiteHostname(): string | null {
  for (const raw of [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_URL,
  ]) {
    const host = raw ? hostnameFromEnvUrl(raw) : null;
    if (host) return host;
  }
  return null;
}

/**
 * Hostname for affiliate-only portal mode in middleware.
 * Returns null when unset or when the portal URL is the same host as the main site
 * (misconfiguration would otherwise redirect / → /affiliate on mcgbot.xyz).
 */
export function affiliateDedicatedPortalHostname(): string | null {
  const raw = process.env.NEXT_PUBLIC_AFFILIATE_PORTAL_URL?.trim();
  if (!raw) return null;
  const portalHost = hostnameFromEnvUrl(raw);
  if (!portalHost) return null;
  const mainHost = mainSiteHostname();
  if (mainHost && portalHost === mainHost) return null;
  return portalHost;
}

/** Base URL for the affiliate portal (optional dedicated host, e.g. https://partners.mcgbot.xyz). */
export function affiliatePortalOrigin(): string {
  const dedicated = process.env.NEXT_PUBLIC_AFFILIATE_PORTAL_URL?.trim();
  if (dedicated) {
    try {
      const origin = new URL(dedicated).origin;
      const portalHost = hostnameFromEnvUrl(dedicated);
      const mainHost = mainSiteHostname();
      if (!portalHost || !mainHost || portalHost !== mainHost) {
        return origin;
      }
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
