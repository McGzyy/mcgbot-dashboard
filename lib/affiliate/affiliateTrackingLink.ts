import { normalizeAffiliateSlug } from "@/lib/affiliate/affiliateSlug";

export function affiliateSiteBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "https://mcgbot.xyz";
  return base.replace(/\/$/, "");
}

export function affiliateTrackingUrl(slug: string, campaignSlug?: string | null): string {
  const s = normalizeAffiliateSlug(slug);
  const base = `${affiliateSiteBaseUrl()}/affiliate/r/${encodeURIComponent(s)}`;
  const c = campaignSlug ? normalizeAffiliateSlug(campaignSlug) : "";
  if (!c) return base;
  return `${base}?${new URLSearchParams({ c }).toString()}`;
}
