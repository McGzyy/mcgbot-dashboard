import {
  AFFILIATE_ATTRIBUTION_CLICK_DAYS,
  AFFILIATE_CAMPAIGN_COOKIE_NAME,
  AFFILIATE_COOKIE_NAME,
} from "@/lib/affiliate/affiliatePolicy";

export type ParsedAffiliateCookie = { affiliateId: string; clickMs: number };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function serializeAffiliateCookie(affiliateId: string, clickMs: number): string {
  return `${affiliateId.trim()}:${Math.floor(clickMs)}`;
}

export function parseAffiliateCookie(raw: string | undefined | null): ParsedAffiliateCookie | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  const idx = s.lastIndexOf(":");
  if (idx <= 0) return null;
  const affiliateId = s.slice(0, idx).trim();
  const clickMs = Number(s.slice(idx + 1));
  if (!UUID_RE.test(affiliateId)) return null;
  if (!Number.isFinite(clickMs) || clickMs <= 0) return null;
  return { affiliateId, clickMs };
}

export function isAffiliateClickFresh(clickMs: number, nowMs: number = Date.now()): boolean {
  return nowMs - clickMs <= AFFILIATE_ATTRIBUTION_CLICK_DAYS * 86_400_000;
}

export function parseAffiliateCampaignId(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const id = raw.trim();
  return UUID_RE.test(id) ? id : null;
}

export function readAffiliateCampaignIdFromCookies(jar: {
  get: (name: string) => { value: string } | undefined;
}): string | null {
  const c = jar.get(AFFILIATE_CAMPAIGN_COOKIE_NAME);
  return parseAffiliateCampaignId(c?.value);
}

/** Set affiliate + optional campaign cookies on a redirect response. */
export function applyAffiliateTrackingCookies(
  res: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } },
  input: { affiliateId: string; campaignId?: string | null; clickMs?: number }
): void {
  const opts = affiliateCookieOptions();
  const clickMs = input.clickMs ?? Date.now();
  res.cookies.set(opts.name, serializeAffiliateCookie(input.affiliateId.trim(), clickMs), {
    httpOnly: opts.httpOnly,
    sameSite: opts.sameSite,
    secure: opts.secure,
    path: opts.path,
    maxAge: opts.maxAgeSec,
  });
  const campaignId = input.campaignId?.trim() || null;
  if (campaignId && UUID_RE.test(campaignId)) {
    res.cookies.set(AFFILIATE_CAMPAIGN_COOKIE_NAME, campaignId, {
      httpOnly: true,
      sameSite: opts.sameSite,
      secure: opts.secure,
      path: "/",
      maxAge: opts.maxAgeSec,
    });
  }
}

export function affiliateCookieOptions(): {
  name: string;
  maxAgeSec: number;
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
} {
  return {
    name: AFFILIATE_COOKIE_NAME,
    maxAgeSec: AFFILIATE_ATTRIBUTION_CLICK_DAYS * 86_400,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
