import {
  AFFILIATE_ANNUAL_MAX_COMMISSION_PAYMENTS,
  AFFILIATE_COMMISSION_HOLD_DAYS,
  AFFILIATE_MONTHLY_MAX_COMMISSION_PAYMENTS,
  AFFILIATE_REVSHARE_BASE_BPS,
  AFFILIATE_REVSHARE_LOYAL_BPS,
  AFFILIATE_REVSHARE_MID_BPS,
  AFFILIATE_REVSHARE_UNLOCK_LOYAL_AT_PAYMENT,
  AFFILIATE_REVSHARE_UNLOCK_MID_AT_PAYMENT,
  annualSignupBonusCents,
  milestoneBonusCents,
  MILESTONE_TIERS,
  revshareRatePercentLabel,
  type MilestoneTier,
} from "@/lib/affiliate/affiliateCommissionSchedule";

function fmtUsd(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

const baseLabel = revshareRatePercentLabel(AFFILIATE_REVSHARE_BASE_BPS);
const midLabel = revshareRatePercentLabel(AFFILIATE_REVSHARE_MID_BPS);
const loyalLabel = revshareRatePercentLabel(AFFILIATE_REVSHARE_LOYAL_BPS);
const midAt = AFFILIATE_REVSHARE_UNLOCK_MID_AT_PAYMENT;
const loyalAt = AFFILIATE_REVSHARE_UNLOCK_LOYAL_AT_PAYMENT;
const monthlyMax = AFFILIATE_MONTHLY_MAX_COMMISSION_PAYMENTS;

/** One-line summaries for apply flow / compact UI. */
export const AFFILIATE_EARNINGS_SUMMARY = {
  recurring: `Earn ${baseLabel} to start, ${midLabel} from their ${midAt}th payment, and ${loyalLabel} from their ${loyalAt}th (through payment ${monthlyMax} on monthly, or the ${AFFILIATE_ANNUAL_MAX_COMMISSION_PAYMENTS}rd annual renewal).`,
  milestones: `One-time bonuses at 10, 25, and 50 qualified actives (${MILESTONE_TIERS.map((t) => fmtUsd(milestoneBonusCents(t))).join(" · ")}).`,
  annual: `Extra ${fmtUsd(annualSignupBonusCents("basic"))} (Basic) or ${fmtUsd(annualSignupBonusCents("pro"))} (Pro) on a referred member’s first annual payment.`,
  hold: `Commissions stay pending for about ${AFFILIATE_COMMISSION_HOLD_DAYS.monthly} days (monthly subscribers) or ${AFFILIATE_COMMISSION_HOLD_DAYS.annual} days (annual) after each payment, then auto-approve if the member is still subscribed.`,
  timingNote:
    "Payment #1, #2, and so on follow each member’s own bills — not calendar months on your calendar.",
} as const;

export const AFFILIATE_RECURRING_COMMISSION_COPY = {
  title: "Recurring commission (loyalty unlocks)",
  lead: `Each person you refer is locked to monthly or annual track based on their first subscription payment. Recurring % applies to each qualifying invoice on that track. Everyone starts at ${baseLabel}; your rate on that referral increases when they reach their ${midAt}th and ${loyalAt}th payments.`,
  monthlyRows: [
    {
      payment: `Payments 1–${midAt - 1}`,
      rate: `${baseLabel} each (base)`,
    },
    {
      payment: `Payments ${midAt}–${loyalAt - 1}`,
      rate: `${midLabel} each (unlocks at their ${midAt}th payment)`,
    },
    {
      payment: `Payments ${loyalAt}–${monthlyMax}`,
      rate: `${loyalLabel} each (unlocks at their ${loyalAt}th payment)`,
    },
    { payment: `Payment ${monthlyMax + 1} onward`, rate: "No commission" },
  ] as const,
  annualRows: [
    {
      payment: "1st annual payment",
      rate: `${baseLabel} + ${fmtUsd(annualSignupBonusCents("basic"))} (Basic) or ${fmtUsd(annualSignupBonusCents("pro"))} (Pro) signup bonus`,
    },
    {
      payment: "2nd annual renewal",
      rate: `${midLabel}`,
    },
    {
      payment: "3rd annual renewal",
      rate: `${loyalLabel}`,
    },
    {
      payment: "4th annual renewal onward",
      rate: "No commission",
    },
  ] as const,
  billingNote:
    "Payment numbers are per referred member, not months on your calendar. Monthly and annual tracks use the same loyalty unlock rules (different payment spacing).",
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
  body: `On a referred member’s first annual invoice only: ${fmtUsd(annualSignupBonusCents("basic"))} for Basic, ${fmtUsd(annualSignupBonusCents("pro"))} for Pro — in addition to the ${baseLabel} rev share on that payment.`,
} as const;
