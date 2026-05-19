import {
  getAffiliateById,
  getAffiliateByReferralCode,
  getAffiliateBySlug,
  type AffiliateAccountRow,
} from "@/lib/affiliate/affiliateDb";
import {
  getAffiliateCampaignByLinkCode,
  getAffiliateCampaignBySlug,
  type AffiliateCampaignRow,
} from "@/lib/affiliate/affiliateCampaigns";
import { recordAffiliateLinkClick } from "@/lib/affiliate/affiliateLinkClicks";
import { normalizeReferralCode } from "@/lib/affiliate/affiliateReferralCode";
import { normalizeAffiliateSlug } from "@/lib/affiliate/affiliateSlug";

export type AffiliateLandingContext = {
  affiliateId: string;
  affiliateSlug: string;
  displayLabel: string;
  campaign: { id: string; slug: string; name: string } | null;
};

async function landingFromAccount(
  account: AffiliateAccountRow,
  campaign: AffiliateCampaignRow | null,
  input: { referrer?: string | null; landingPath?: string | null }
): Promise<AffiliateLandingContext> {
  await recordAffiliateLinkClick({
    affiliateId: account.id,
    campaignId: campaign?.id ?? null,
    referrer: input.referrer,
    landingPath: input.landingPath,
  });

  return {
    affiliateId: account.id,
    affiliateSlug: account.affiliateSlug ?? "",
    displayLabel: account.displayName ?? "McGBot affiliate",
    campaign: campaign
      ? { id: campaign.id, slug: campaign.slug, name: campaign.name }
      : null,
  };
}

/** Resolve mcgbot.xyz/r/{code} — campaign link_code first, then account referral_code. */
export async function resolveAffiliateLandingByPublicCode(input: {
  code: string;
  referrer?: string | null;
  landingPath?: string | null;
}): Promise<AffiliateLandingContext | null> {
  const code = normalizeReferralCode(input.code);
  if (!code) return null;

  const campaign = await getAffiliateCampaignByLinkCode(code);
  if (campaign) {
    const account = await getAffiliateById(campaign.affiliateId);
    if (!account || account.status !== "active") return null;
    return landingFromAccount(account, campaign, input);
  }

  const account = await getAffiliateByReferralCode(code);
  if (!account || account.status !== "active") return null;
  return landingFromAccount(account, null, input);
}

/** Legacy mcgbot.xyz/affiliate/r/{slug}?c=… */
export async function resolveAffiliateLandingBySlug(input: {
  affiliateSlug: string;
  campaignSlug?: string | null;
  referrer?: string | null;
  landingPath?: string | null;
}): Promise<AffiliateLandingContext | null> {
  const affiliateSlug = normalizeAffiliateSlug(input.affiliateSlug);
  const account = await getAffiliateBySlug(affiliateSlug);
  if (!account || account.status !== "active") return null;

  let campaign: AffiliateCampaignRow | null = null;
  const rawCampaign = input.campaignSlug ? normalizeAffiliateSlug(input.campaignSlug) : "";
  if (rawCampaign) {
    campaign = await getAffiliateCampaignBySlug(account.id, rawCampaign);
  }

  return landingFromAccount(account, campaign, input);
}
