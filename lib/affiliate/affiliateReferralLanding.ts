import { getAffiliateBySlug } from "@/lib/affiliate/affiliateDb";
import { getAffiliateCampaignBySlug } from "@/lib/affiliate/affiliateCampaigns";
import { recordAffiliateLinkClick } from "@/lib/affiliate/affiliateLinkClicks";
import { normalizeAffiliateSlug } from "@/lib/affiliate/affiliateSlug";

export type AffiliateLandingContext = {
  affiliateId: string;
  affiliateSlug: string;
  displayLabel: string;
  campaign: { id: string; slug: string; name: string } | null;
};

/** Resolve partner + optional campaign and record a landing click. */
export async function resolveAffiliateLanding(input: {
  affiliateSlug: string;
  campaignSlug?: string | null;
  referrer?: string | null;
  landingPath?: string | null;
}): Promise<AffiliateLandingContext | null> {
  const affiliateSlug = normalizeAffiliateSlug(input.affiliateSlug);
  const account = await getAffiliateBySlug(affiliateSlug);
  if (!account || account.status !== "active") return null;

  let campaign: AffiliateLandingContext["campaign"] = null;
  const rawCampaign = input.campaignSlug ? normalizeAffiliateSlug(input.campaignSlug) : "";
  if (rawCampaign) {
    const row = await getAffiliateCampaignBySlug(account.id, rawCampaign);
    if (row) campaign = { id: row.id, slug: row.slug, name: row.name };
  }

  await recordAffiliateLinkClick({
    affiliateId: account.id,
    campaignId: campaign?.id ?? null,
    referrer: input.referrer,
    landingPath: input.landingPath,
  });

  return {
    affiliateId: account.id,
    affiliateSlug: account.affiliateSlug ?? affiliateSlug,
    displayLabel: account.displayName ?? "McGBot partner",
    campaign,
  };
}
