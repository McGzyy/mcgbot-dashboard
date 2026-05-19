import type { ProductTier } from "@/lib/subscription/planTiers";

export const AFFILIATE_REVSHARE_PRIMARY_BPS = 2000;
export const AFFILIATE_REVSHARE_TAIL_BPS = 1000;

/** Monthly: payments 1–12 at 20%, 13–36 at 10%, then none. */
export const AFFILIATE_MONTHLY_COMMISSION = {
  primaryPayments: 12,
  tailPayments: 24,
} as const;

/** Annual: payment 1 at 20%, payments 2–3 at 10%, then none. */
export const AFFILIATE_ANNUAL_COMMISSION = {
  primaryPayments: 1,
  tailPayments: 2,
} as const;

export const AFFILIATE_COMMISSION_HOLD_DAYS = {
  monthly: 30,
  annual: 90,
} as const;

export function commissionRateBpsForReferralPayment(input: {
  paymentIndex: number;
  billingInterval: "monthly" | "annual";
}): number | null {
  const n = Math.floor(input.paymentIndex);
  if (n < 1) return null;

  if (input.billingInterval === "annual") {
    if (n === 1) return AFFILIATE_REVSHARE_PRIMARY_BPS;
    if (n <= AFFILIATE_ANNUAL_COMMISSION.primaryPayments + AFFILIATE_ANNUAL_COMMISSION.tailPayments) {
      return AFFILIATE_REVSHARE_TAIL_BPS;
    }
    return null;
  }

  if (n <= AFFILIATE_MONTHLY_COMMISSION.primaryPayments) return AFFILIATE_REVSHARE_PRIMARY_BPS;
  const tailEnd =
    AFFILIATE_MONTHLY_COMMISSION.primaryPayments + AFFILIATE_MONTHLY_COMMISSION.tailPayments;
  if (n <= tailEnd) return AFFILIATE_REVSHARE_TAIL_BPS;
  return null;
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
