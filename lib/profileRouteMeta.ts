export type ProfileMetaPayload = {
  discordId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isTopCaller: boolean;
  isTrustedPro: boolean;
  stats: { avgX: number; winRate: number; totalCalls: number };
};

/** Canonical origin for OG generation (Edge-safe — no `headers()`). */
export function siteOriginForOG(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const v = process.env.VERCEL_URL?.trim();
  if (v) return `https://${v.replace(/^https?:\/\//, "")}`;
  return "https://mcgbot.xyz";
}

/** Prefer incoming request host when generating HTML metadata. */
export async function resolveRequestSiteOrigin(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const hostRaw = h.get("x-forwarded-host") ?? h.get("host");
    const host = hostRaw?.split(",")[0]?.trim();
    const protoRaw = h.get("x-forwarded-proto") ?? "https";
    const proto = protoRaw.split(",")[0].trim();
    if (host) return `${proto}://${host}`;
  } catch {
    /* build / static paths without request */
  }
  return siteOriginForOG();
}

export async function fetchProfileMeta(
  origin: string,
  routeParam: string
): Promise<ProfileMetaPayload | null> {
  const base = origin.replace(/\/$/, "");
  const trimmed = decodeURIComponent(String(routeParam ?? "")).trim();
  if (!trimmed) return null;
  try {
    const res = await fetch(`${base}/api/user/${encodeURIComponent(trimmed)}`, {
      next: { revalidate: 120 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    if (!data || typeof data !== "object" || typeof data.error === "string") return null;
    const statsRaw = data.stats as Record<string, unknown> | undefined;
    const avgX =
      typeof statsRaw?.avgX === "number" ? statsRaw.avgX : Number(statsRaw?.avgX) || 0;
    const winRate =
      typeof statsRaw?.winRate === "number"
        ? statsRaw.winRate
        : Number(statsRaw?.winRate) || 0;
    const totalCalls =
      typeof statsRaw?.totalCalls === "number"
        ? statsRaw.totalCalls
        : Number(statsRaw?.totalCalls) || 0;
    const dn =
      typeof data.displayName === "string" && data.displayName.trim()
        ? data.displayName.trim()
        : "Caller";
    const un = typeof data.username === "string" ? data.username : "";
    return {
      discordId: String(data.discordId ?? ""),
      username: un,
      displayName: dn,
      avatarUrl:
        typeof data.avatarUrl === "string" && data.avatarUrl.trim()
          ? data.avatarUrl.trim().slice(0, 800)
          : null,
      bio:
        data.bio == null ? null : typeof data.bio === "string" ? data.bio : String(data.bio),
      isTopCaller: Boolean(data.isTopCaller),
      isTrustedPro: Boolean(data.isTrustedPro),
      stats: { avgX, winRate, totalCalls },
    };
  } catch {
    return null;
  }
}

export function profileMetaDescription(p: ProfileMetaPayload): string {
  const parts: string[] = [];
  if (p.stats.totalCalls > 0) {
    parts.push(
      `${p.stats.totalCalls} calls · ${p.stats.avgX.toFixed(1)}× avg · ${Math.round(p.stats.winRate)}% WR`
    );
  }
  if (p.isTopCaller) parts.push("Top Caller");
  if (p.isTrustedPro) parts.push("Trusted Pro");
  if (p.bio?.trim()) {
    const b = p.bio.trim();
    parts.push(b.length > 140 ? `${b.slice(0, 137)}…` : b);
  }
  if (parts.length === 0) parts.push("Caller profile on McGBot Terminal.");
  return parts.slice(0, 4).join(" · ");
}
