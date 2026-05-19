import {
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

/** One-line summaries for apply flow / compact UI. */
export const AFFILIATE_EARNINGS_SUMMARY = {
  recurring:
    "Earn 15–25% on each referred member’s first 12 subscription payments (their 2nd payment pays the highest rate).",
  milestones: `One-time bonuses at 10, 25, and 50 qualified actives (${MILESTONE_TIERS.map((t) => fmtUsd(milestoneBonusCents(t))).join(" · ")}).`,
  annual: `Extra ${fmtUsd(annualSignupBonusCents("basic"))} (Basic) or ${fmtUsd(annualSignupBonusCents("pro"))} (Pro) when someone you referred chooses an annual plan.`,
  timingNote:
    "Payment #1, #2, and so on follow each member’s own bills — not calendar months on your calendar.",
} as const;

export const AFFILIATE_RECURRING_COMMISSION_COPY = {
  title: "Recurring commission",
  lead: "Each person you refer has their own payment timeline. You earn a percentage of their subscription payments, up through their 12th payment.",
  rows: [
    { payment: "1st payment", rate: "15%" },
    { payment: "2nd payment", rate: "25%" },
    { payment: "3rd–12th payments", rate: "15% each" },
    { payment: "13th payment onward", rate: "No commission" },
  ] as const,
  billingNote:
    "Monthly members: usually one payment per month. Annual members: one payment per year, still counted as payment #1, #2, etc. when they renew.",
} as const;

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
  body: `If a referred member chooses an annual plan, you get a one-time bonus on their first annual invoice: ${fmtUsd(annualSignupBonusCents("basic"))} on Basic, ${fmtUsd(annualSignupBonusCents("pro"))} on Pro.`,
} as const;
