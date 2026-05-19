import {
  AFFILIATE_ANNUAL_COMMISSION,
  AFFILIATE_COMMISSION_HOLD_DAYS,
  AFFILIATE_MONTHLY_COMMISSION,
  annualSignupBonusCents,
  milestoneBonusCents,
  MILESTONE_TIERS,
  type MilestoneTier,
} from "@/lib/affiliate/affiliateCommissionSchedule";

function fmtUsd(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

const monthlyTailEnd =
  AFFILIATE_MONTHLY_COMMISSION.primaryPayments + AFFILIATE_MONTHLY_COMMISSION.tailPayments;

/** One-line summaries for apply flow / compact UI. */
export const AFFILIATE_EARNINGS_SUMMARY = {
  recurring:
    "Earn 20% on qualifying subscription payments, then 10% on tail payments (monthly vs annual schedules differ).",
  milestones: `One-time bonuses at 10, 25, and 50 qualified actives (${MILESTONE_TIERS.map((t) => fmtUsd(milestoneBonusCents(t))).join(" · ")}).`,
  annual: `Extra ${fmtUsd(annualSignupBonusCents("basic"))} (Basic) or ${fmtUsd(annualSignupBonusCents("pro"))} (Pro) on a referred member’s first annual payment.`,
  hold: `Commissions stay pending for about ${AFFILIATE_COMMISSION_HOLD_DAYS.monthly} days (monthly subscribers) or ${AFFILIATE_COMMISSION_HOLD_DAYS.annual} days (annual) after each payment, then auto-approve if the member is still subscribed.`,
  timingNote:
    "Payment #1, #2, and so on follow each member’s own bills — not calendar months on your calendar.",
} as const;

export const AFFILIATE_RECURRING_COMMISSION_COPY = {
  title: "Recurring commission",
  lead: "Each person you refer is locked to monthly or annual commission track based on their first subscription payment. You earn a percentage of what they actually pay on each qualifying invoice.",
  monthlyRows: [
    { payment: `Payments 1–${AFFILIATE_MONTHLY_COMMISSION.primaryPayments}`, rate: "20% each" },
    {
      payment: `Payments ${AFFILIATE_MONTHLY_COMMISSION.primaryPayments + 1}–${monthlyTailEnd}`,
      rate: "10% each",
    },
    { payment: `Payment ${monthlyTailEnd + 1} onward`, rate: "No commission" },
  ] as const,
  annualRows: [
    {
      payment: "1st annual payment",
      rate: `20% of invoice + ${fmtUsd(annualSignupBonusCents("basic"))} (Basic) or ${fmtUsd(annualSignupBonusCents("pro"))} (Pro) signup bonus`,
    },
    {
      payment: `2nd–${AFFILIATE_ANNUAL_COMMISSION.primaryPayments + AFFILIATE_ANNUAL_COMMISSION.tailPayments} annual renewals`,
      rate: "10% each",
    },
    {
      payment: `${AFFILIATE_ANNUAL_COMMISSION.primaryPayments + AFFILIATE_ANNUAL_COMMISSION.tailPayments + 1}th annual renewal onward`,
      rate: "No commission",
    },
  ] as const,
  billingNote:
    "The % applies to the invoice amount for that payment (monthly or annual). Payment numbers are per referred member, not months on your calendar.",
  holdNote: AFFILIATE_EARNINGS_SUMMARY.hold,
} as const;

/** @deprecated Use AFFILIATE_RECURRING_COMMISSION_COPY.monthlyRows — kept for table components expecting `rows`. */
export const AFFILIATE_RECURRING_COMMISSION_ROWS = AFFILIATE_RECURRING_COMMISSION_COPY.monthlyRows;

export function milestoneQualifierCopy(tier: MilestoneTier): string {
  if (tier === 10) {
    return "Paid once, stayed subscribed 7+ days, still active when we count them.";
  }
  return "Second subscription payment cleared and still subscribed when we count them.";
}

export const AFFILIATE_MILESTONE_COPY = {
  title: "Referral milestone bonuses",
  lead: "Separate from the % commissions above — cash bonuses when you hit qualified active referral counts.",
  tiers: MILESTONE_TIERS.map((tier) => ({
    tier,
    amountLabel: fmtUsd(milestoneBonusCents(tier)),
    qualifier: milestoneQualifierCopy(tier),
  })),
} as const;

export const AFFILIATE_ANNUAL_BONUS_COPY = {
  title: "Annual plan signup bonus",
  body: `On a referred member’s first annual invoice only: ${fmtUsd(annualSignupBonusCents("basic"))} for Basic, ${fmtUsd(annualSignupBonusCents("pro"))} for Pro — in addition to the 20% rev share on that payment.`,
} as const;
