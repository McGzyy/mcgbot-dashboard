/** Shared copy/formatting for membership plan cards and checkout summaries. */

/** Billing periods offered on /membership (quarterly etc. can be added later). */
export const SELLABLE_BILLING_MONTHS = [1, 12] as const;

export function isSellableBillingMonths(months: number): boolean {
  const m = Math.floor(Number(months) || 0);
  return (SELLABLE_BILLING_MONTHS as readonly number[]).includes(m);
}

export function formatUsd(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

export function planMonthlyEquivalent(priceUsd: number, billingMonths: number): number | null {
  const price = Number(priceUsd);
  const months = Math.max(1, Math.floor(Number(billingMonths) || 0));
  if (!Number.isFinite(price) || months < 1) return null;
  return price / months;
}

export function billingCadenceLabel(billingMonths: number, durationDays: number): string {
  const m = Math.max(0, Math.floor(Number(billingMonths) || 0));
  if (m === 1) return "Billed monthly";
  if (m === 3) return "Billed every 3 months";
  if (m === 6) return "Billed every 6 months";
  if (m === 12) return "Billed annually";
  if (m > 1) return `Billed every ${m} months`;
  const d = Math.floor(Number(durationDays));
  if (d > 0) return `${d}-day access period`;
  return "Recurring in Stripe";
}

export function billingPeriodNoun(billingMonths: number): string {
  const m = Math.max(1, Math.floor(Number(billingMonths) || 1));
  if (m === 1) return "month";
  if (m === 12) return "year";
  return `${m} months`;
}
