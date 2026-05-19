import type Stripe from "stripe";

import { isAffiliateClickFresh, parseAffiliateCookie } from "@/lib/affiliate/affiliateCookie";
import { AFFILIATE_COOKIE_NAME } from "@/lib/affiliate/affiliatePolicy";
import { upsertAffiliateAttribution } from "@/lib/affiliate/affiliateAttribution";
import { recordAffiliateCommissionFromStripeInvoice } from "@/lib/affiliate/affiliateCommissions";
import { isValidDiscordSnowflake } from "@/lib/subscription/exemptAllowlistDb";
import { getPlanDurationDays, getPlanIdByStripeSubscriptionId } from "@/lib/subscription/subscriptionDb";
import { resolveStripeInvoiceProceedsCents } from "@/lib/subscription/stripeInvoiceProceeds";

/**
 * After a paid Stripe subscription invoice: apply last-click affiliate attribution (if fresh) and accrue commission.
 */
export async function processStripeInvoicePaidForAffiliates(opts: {
  stripe: Stripe;
  invoice: Stripe.Invoice;
}): Promise<void> {
  const inv = opts.invoice;
  const subRef = (inv as unknown as { subscription?: string | Stripe.Subscription | null }).subscription;
  const subId =
    typeof subRef === "string"
      ? subRef.trim()
      : subRef && typeof subRef === "object" && !Array.isArray(subRef) && "id" in subRef
        ? String((subRef as { id: string }).id).trim()
        : "";
  if (!subId) return;

  const proceeds = await resolveStripeInvoiceProceedsCents(opts.stripe, inv);
  if (!proceeds || proceeds.netCents <= 0) return;

  let sub: Stripe.Subscription;
  try {
    sub = await opts.stripe.subscriptions.retrieve(subId);
  } catch {
    return;
  }

  const md = sub.metadata ?? {};
  const discordId = typeof md.discord_id === "string" ? md.discord_id.trim() : "";
  if (!discordId || !isValidDiscordSnowflake(discordId)) return;

  const affiliateIdRaw = typeof md.affiliate_id === "string" ? md.affiliate_id.trim() : "";
  const clickMs = Number(md.affiliate_click_ms);
  if (affiliateIdRaw && Number.isFinite(clickMs) && isAffiliateClickFresh(clickMs)) {
    await upsertAffiliateAttribution({
      referredUserId: discordId,
      affiliateId: affiliateIdRaw,
      attributionSource: "web_cookie_checkout",
    });
  }

  let planId = typeof md.plan_id === "string" ? md.plan_id.trim() : "";
  if (!planId) {
    planId = (await getPlanIdByStripeSubscriptionId(subId)) ?? "";
  }
  if (!planId) return;

  const days = await getPlanDurationDays(planId);
  if (days == null || days <= 0) return;

  const result = await recordAffiliateCommissionFromStripeInvoice({
    referredDiscordId: discordId,
    stripeInvoiceId: inv.id,
    amountPaidCents: proceeds.grossCents,
    commissionBasisCents: proceeds.netCents,
    stripeFeeCents: proceeds.stripeFeeCents,
    planId,
  });
  if (!result.ok) {
    console.warn("[stripe affiliate] accrual failed", result.error, inv.id);
  } else if (proceeds.feeSource === "estimate") {
    console.info("[stripe affiliate] used estimated Stripe fee", inv.id, proceeds.stripeFeeCents);
  }
}

export function stripeAffiliateMetadataFromCookieValue(raw: string | undefined): {
  affiliate_id: string;
  affiliate_click_ms: string;
} | null {
  if (!raw || typeof raw !== "string") return null;
  const parsed = parseAffiliateCookie(raw);
  if (!parsed || !isAffiliateClickFresh(parsed.clickMs)) return null;
  return {
    affiliate_id: parsed.affiliateId,
    affiliate_click_ms: String(parsed.clickMs),
  };
}

export function readAffiliateStripeMetadataFromCookies(jar: {
  get: (name: string) => { value: string } | undefined;
}): { affiliate_id: string; affiliate_click_ms: string } | null {
  const c = jar.get(AFFILIATE_COOKIE_NAME);
  return stripeAffiliateMetadataFromCookieValue(c?.value);
}
