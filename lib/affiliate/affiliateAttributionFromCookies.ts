import { readAffiliateStripeMetadataFromCookies } from "@/lib/subscription/stripeAffiliateInvoice";
import {
  upsertAffiliateAttribution,
  type AffiliateAttributionSource,
} from "@/lib/affiliate/affiliateAttribution";

/** Last-click affiliate attribution from `mcgbot_affiliate_click` (Stripe/SOL checkout). */
export async function applyAffiliateAttributionFromCookies(
  referredUserId: string,
  jar: { get: (name: string) => { value: string } | undefined },
  attributionSource: AffiliateAttributionSource = "web_cookie_checkout"
): Promise<boolean> {
  const referred = referredUserId.trim();
  if (!referred) return false;
  const meta = readAffiliateStripeMetadataFromCookies(jar);
  if (!meta?.affiliate_id?.trim()) return false;
  const affiliateId = meta.affiliate_id.trim();
  const campaignId =
    typeof meta.affiliate_campaign_id === "string" ? meta.affiliate_campaign_id : null;
  return upsertAffiliateAttribution({
    referredUserId: referred,
    affiliateId,
    campaignId,
    attributionSource,
  });
}
