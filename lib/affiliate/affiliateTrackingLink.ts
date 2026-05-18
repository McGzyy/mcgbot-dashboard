import { normalizeAffiliateSlug } from "@/lib/affiliate/affiliateSlug";

export function affiliateSiteBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "https://mcgbot.xyz";
  return base.replace(/\/$/, "");
}

export function affiliateTrackingUrl(slug: string): string {
  const s = normalizeAffiliateSlug(slug);
  return `${affiliateSiteBaseUrl()}/affiliate/r/${encodeURIComponent(s)}`;
}
