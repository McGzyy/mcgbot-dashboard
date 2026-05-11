/** Product constants for member referral credit (not affiliates). */

export const REFERRAL_CREDIT_PERCENT = 0.1;

/** List-price monthly anchor for Cap A (USD). */
export const REFERRAL_LIST_MONTHLY_USD = 49.99;

export function listMonthlyPriceCents(): number {
  const env = Number((process.env.REFERRAL_LIST_MONTHLY_USD ?? "").trim());
  if (Number.isFinite(env) && env > 0) return Math.round(env * 100);
  return Math.round(REFERRAL_LIST_MONTHLY_USD * 100);
}

/** Max credit (USD cents) per referred member in their first 24 months of paid membership (Cap A). */
export function capPerRefereeCents(): number {
  return 6 * listMonthlyPriceCents();
}

export function refundWindowDays(): number {
  const n = Math.floor(Number((process.env.REFERRAL_REFUND_WINDOW_DAYS ?? "14").trim()));
  if (!Number.isFinite(n) || n < 0) return 14;
  return Math.min(90, Math.max(0, n));
}

/** Web referral click is valid for Stripe metadata if within this many days. */
export const REFERRAL_ATTRIBUTION_CLICK_DAYS = 7;

export const REFERRAL_COOKIE_NAME = "mcgbot_referrer_click";

/** Max subscription-month equivalents redeemable via credit per exempt segment. */
export const REFERRAL_EXEMPT_SEGMENT_REDEEM_CAP_MONTHS = 3;
