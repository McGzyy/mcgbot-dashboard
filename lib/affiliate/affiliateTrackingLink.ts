import { normalizeReferralCode } from "@/lib/affiliate/affiliateReferralCode";

export function affiliateSiteBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "https://mcgbot.xyz";
  return base.replace(/\/$/, "");
}

/** Short public link: mcgbot.xyz/r/H3K8Z */
export function affiliateShortReferralUrl(referralCode: string): string {
  const code = normalizeReferralCode(referralCode);
  return `${affiliateSiteBaseUrl()}/r/${encodeURIComponent(code)}`;
}

export function affiliateShortCampaignUrl(linkCode: string): string {
  const code = normalizeReferralCode(linkCode);
  return `${affiliateSiteBaseUrl()}/r/${encodeURIComponent(code)}`;
}

/** @deprecated Legacy vanity path — prefer affiliateShortReferralUrl when referral_code exists. */
export function affiliateTrackingUrl(slug: string, campaignSlug?: string | null): string {
  const base = `${affiliateSiteBaseUrl()}/affiliate/r/${encodeURIComponent(slug.trim().toLowerCase())}`;
  const c = campaignSlug?.trim().toLowerCase() ?? "";
  if (!c) return base;
  return `${base}?${new URLSearchParams({ c }).toString()}`;
}
