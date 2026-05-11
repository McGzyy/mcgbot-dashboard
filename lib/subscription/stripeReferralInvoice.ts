import type Stripe from "stripe";

import { isReferrerClickFresh, parseReferrerCookie } from "@/lib/referralCookie";
import { REFERRAL_COOKIE_NAME } from "@/lib/referralPolicy";
import { isValidDiscordSnowflake } from "@/lib/subscription/exemptAllowlistDb";
import { getPlanDurationDays, getPlanIdByStripeSubscriptionId } from "@/lib/subscription/subscriptionDb";
import {
  recordReferralAccrualFromStripeInvoice,
  upsertReferralFromWebAttribution,
} from "@/lib/referralRewards";

/**
 * After a paid Stripe subscription invoice: apply last-click web attribution (if fresh) and accrue referrer credit.
 */
export async function processStripeInvoicePaidForReferrals(opts: {
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

  const amountPaid = typeof inv.amount_paid === "number" ? inv.amount_paid : 0;
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) return;

  let sub: Stripe.Subscription;
  try {
    sub = await opts.stripe.subscriptions.retrieve(subId);
  } catch {
    return;
  }

  const md = sub.metadata ?? {};
  const discordId = typeof md.discord_id === "string" ? md.discord_id.trim() : "";
  if (!discordId || !isValidDiscordSnowflake(discordId)) return;

  const refOwnerRaw = typeof md.referrer_discord_id === "string" ? md.referrer_discord_id.trim() : "";
  const clickMs = Number(md.referrer_click_ms);
  if (
    refOwnerRaw &&
    isValidDiscordSnowflake(refOwnerRaw) &&
    refOwnerRaw !== discordId &&
    Number.isFinite(clickMs) &&
    isReferrerClickFresh(clickMs)
  ) {
    await upsertReferralFromWebAttribution({
      referredUserId: discordId,
      ownerDiscordId: refOwnerRaw,
    });
  }

  let planId = typeof md.plan_id === "string" ? md.plan_id.trim() : "";
  if (!planId) {
    planId = (await getPlanIdByStripeSubscriptionId(subId)) ?? "";
  }
  if (!planId) return;

  const days = await getPlanDurationDays(planId);
  if (days == null || days <= 0) return;

  const result = await recordReferralAccrualFromStripeInvoice({
    referredDiscordId: discordId,
    stripeInvoiceId: inv.id,
    amountPaidCents: amountPaid,
    refereePeriodDays: days,
  });
  if (!result.ok) {
    console.warn("[stripe referral] accrual failed", result.error, inv.id);
  }
}

/** Build Stripe metadata fields for subscription checkout (last-click attribution). */
export function stripeReferrerMetadataFromCookieValue(raw: string | undefined): {
  referrer_discord_id: string;
  referrer_click_ms: string;
} | null {
  if (!raw || typeof raw !== "string") return null;
  const parsed = parseReferrerCookie(raw);
  if (!parsed || !isReferrerClickFresh(parsed.clickMs)) return null;
  return {
    referrer_discord_id: parsed.referrerDiscordId,
    referrer_click_ms: String(parsed.clickMs),
  };
}

export function readReferrerStripeMetadataFromCookies(jar: {
  get: (name: string) => { value: string } | undefined;
}): { referrer_discord_id: string; referrer_click_ms: string } | null {
  const c = jar.get(REFERRAL_COOKIE_NAME);
  return stripeReferrerMetadataFromCookieValue(c?.value);
}
