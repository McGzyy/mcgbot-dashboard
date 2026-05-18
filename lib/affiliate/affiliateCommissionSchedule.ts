import type { ProductTier } from "@/lib/subscription/planTiers";

/** Rev share by payment index (1–12). Index 13+ earns nothing. */
export function commissionRateBpsForPaymentIndex(paymentIndex: number): number | null {
  const n = Math.floor(paymentIndex);
  if (n < 1 || n > 12) return null;
  if (n === 1) return 1500;
  if (n === 2) return 2500;
  return 1500;
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
