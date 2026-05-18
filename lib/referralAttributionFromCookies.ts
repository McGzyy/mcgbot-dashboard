import { readReferrerStripeMetadataFromCookies } from "@/lib/subscription/stripeReferralInvoice";
import {
  upsertReferralFromWebAttribution,
  type ReferralAttributionSource,
} from "@/lib/referralRewards";

/** Last-click web attribution from `mcgbot_referrer_click` (Stripe/SOL checkout). */
export async function applyReferralAttributionFromCookies(
  referredUserId: string,
  jar: { get: (name: string) => { value: string } | undefined },
  attributionSource: ReferralAttributionSource = "web_cookie_checkout"
): Promise<boolean> {
  const referred = referredUserId.trim();
  if (!referred) return false;
  const meta = readReferrerStripeMetadataFromCookies(jar);
  if (!meta?.referrer_discord_id?.trim()) return false;
  const owner = meta.referrer_discord_id.trim();
  if (owner === referred) return false;
  return upsertReferralFromWebAttribution({
    referredUserId: referred,
    ownerDiscordId: owner,
    attributionSource,
  });
}
