import type { ProductTier } from "@/lib/subscription/planTiers";

/** Model A — base rate, then loyalty unlocks at payment 6 and 12 (per referred member). */
export const AFFILIATE_REVSHARE_BASE_BPS = 1500;
export const AFFILIATE_REVSHARE_MID_BPS = 2000;
export const AFFILIATE_REVSHARE_LOYAL_BPS = 2500;

export const AFFILIATE_REVSHARE_UNLOCK_MID_AT_PAYMENT = 6;
export const AFFILIATE_REVSHARE_UNLOCK_LOYAL_AT_PAYMENT = 12;

export const AFFILIATE_MONTHLY_MAX_COMMISSION_PAYMENTS = 36;
export const AFFILIATE_ANNUAL_MAX_COMMISSION_PAYMENTS = 3;

/** Default per-account bps on approve (starting tier; ledger uses loyalty schedule per referral). */
export const AFFILIATE_DEFAULT_COMMISSION_RATE_BPS = AFFILIATE_REVSHARE_BASE_BPS;

/** @deprecated Use AFFILIATE_REVSHARE_MID_BPS */
export const AFFILIATE_REVSHARE_PRIMARY_BPS = AFFILIATE_REVSHARE_MID_BPS;
/** @deprecated Use AFFILIATE_REVSHARE_LOYAL_BPS */
export const AFFILIATE_REVSHARE_TAIL_BPS = AFFILIATE_REVSHARE_LOYAL_BPS;

/** @deprecated Use AFFILIATE_MONTHLY_MAX_COMMISSION_PAYMENTS */
export const AFFILIATE_MONTHLY_COMMISSION = {
  primaryPayments: AFFILIATE_REVSHARE_UNLOCK_LOYAL_AT_PAYMENT - 1,
  tailPayments:
    AFFILIATE_MONTHLY_MAX_COMMISSION_PAYMENTS - (AFFILIATE_REVSHARE_UNLOCK_LOYAL_AT_PAYMENT - 1),
} as const;

/** @deprecated Use AFFILIATE_ANNUAL_MAX_COMMISSION_PAYMENTS */
export const AFFILIATE_ANNUAL_COMMISSION = {
  primaryPayments: 1,
  tailPayments: AFFILIATE_ANNUAL_MAX_COMMISSION_PAYMENTS - 1,
} as const;

export const AFFILIATE_COMMISSION_HOLD_DAYS = {
  monthly: 30,
  annual: 90,
} as const;

export function revshareRatePercentLabel(bps: number): string {
  const pct = bps / 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

export function commissionRateBpsForReferralPayment(input: {
  paymentIndex: number;
  billingInterval: "monthly" | "annual";
}): number | null {
  const n = Math.floor(input.paymentIndex);
  if (n < 1) return null;

  const maxPayments =
    input.billingInterval === "annual"
      ? AFFILIATE_ANNUAL_MAX_COMMISSION_PAYMENTS
      : AFFILIATE_MONTHLY_MAX_COMMISSION_PAYMENTS;
  if (n > maxPayments) return null;

  if (n >= AFFILIATE_REVSHARE_UNLOCK_LOYAL_AT_PAYMENT) return AFFILIATE_REVSHARE_LOYAL_BPS;
  if (n >= AFFILIATE_REVSHARE_UNLOCK_MID_AT_PAYMENT) return AFFILIATE_REVSHARE_MID_BPS;
  return AFFILIATE_REVSHARE_BASE_BPS;
}

/** @deprecated Use commissionRateBpsForReferralPayment */
export function commissionRateBpsForPaymentIndex(paymentIndex: number): number | null {
  return commissionRateBpsForReferralPayment({
    paymentIndex,
    billingInterval: "monthly",
  });
}

export function commissionHoldDays(billingInterval: "monthly" | "annual"): number {
  return billingInterval === "annual"
    ? AFFILIATE_COMMISSION_HOLD_DAYS.annual
    : AFFILIATE_COMMISSION_HOLD_DAYS.monthly;
}

export function commissionEligibleAt(
  paidAt: Date,
  billingInterval: "monthly" | "annual"
): string {
  const days = commissionHoldDays(billingInterval);
  const d = new Date(paidAt.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function annualSignupBonusCents(productTier: ProductTier): number {
  return productTier === "pro" ? 1000 : 500;
}

export function isAnnualPlanBilling(billingMonths: number): boolean {
  return Math.floor(billingMonths) >= 12;
}

export const MILESTONE_TIERS = [10, 25, 50] as const;
export type MilestoneTier = (typeof MILESTONE_TIERS)[number];

export function milestoneBonusCents(tier: MilestoneTier): number {
  if (tier === 10) return 6000;
  if (tier === 25) return 15000;
  return 30000;
}

/** Tier 1: 1st payment + 7 days + still subscribed. Tiers 25/50: 2nd payment + subscribed. */
export function milestoneTierRequiresSecondPayment(tier: MilestoneTier): boolean {
  return tier === 25 || tier === 50;
}

/** Partner dashboard / API program payload. */
export function affiliateRevShareScheduleForProgram() {
  const base = AFFILIATE_REVSHARE_BASE_BPS / 100;
  const mid = AFFILIATE_REVSHARE_MID_BPS / 100;
  const loyal = AFFILIATE_REVSHARE_LOYAL_BPS / 100;
  const midStart = AFFILIATE_REVSHARE_UNLOCK_MID_AT_PAYMENT;
  const loyalStart = AFFILIATE_REVSHARE_UNLOCK_LOYAL_AT_PAYMENT;
  const monthlyMax = AFFILIATE_MONTHLY_MAX_COMMISSION_PAYMENTS;

  return {
    model: "loyalty_unlock" as const,
    unlockMidAtPayment: midStart,
    unlockLoyalAtPayment: loyalStart,
    monthly: [
      { payments: `1-${midStart - 1}`, ratePercent: base },
      { payments: `${midStart}-${loyalStart - 1}`, ratePercent: mid },
      { payments: `${loyalStart}-${monthlyMax}`, ratePercent: loyal },
    ],
    annual: [
      { payments: "1", ratePercent: base },
      { payments: "2", ratePercent: mid },
      { payments: "3", ratePercent: loyal },
    ],
    holdDays: { ...AFFILIATE_COMMISSION_HOLD_DAYS },
    revShareOnNetAfterStripeFees: true,
  };
}
