/** Bump when moderator agreement text changes — active staff must re-sign. */
export const CURRENT_MOD_AGREEMENT_VERSION = "2026-05-31-staff-v1";

export const MOD_AGREEMENT_TITLE = "McGBot Staff Moderator Agreement";

export const MOD_AGREEMENT_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "Elite stewardship",
    body: "You are part of McGBot’s inner circle of staff moderators. Members trust you to protect signal quality, fair attribution, and the integrity of our review systems. You represent the product in every approval, denial, and escalation — act with judgment, consistency, and respect.",
  },
  {
    heading: "Scope & authority",
    body: "Your authority covers dashboard moderation queues, call and coin approvals, Trusted Pro and report desks, and related staff tools exposed to your role tier. You do not change bot infrastructure, treasury, subscription pricing, or admin-only control-plane settings unless you are separately authorized as an admin. When unsure, escalate rather than improvise.",
  },
  {
    heading: "Confidentiality",
    body: "Do not share non-public McGBot metrics, unreleased features, private member data, or internal staff discussions outside approved channels. Screenshots and exports from staff tools stay within staff workflows unless an admin explicitly approves otherwise.",
  },
  {
    heading: "Conduct & conflicts",
    body: "Decide fairly. Do not approve your own submissions, trade on non-public queue information, or retaliate against members. Disclose conflicts to an admin. Spam, harassment, and policy violations are grounds for immediate suspension from staff tools.",
  },
  {
    heading: "Compensation",
    body: "Stipend and payout terms are set individually by McGBot admins (see your roster entry). Until a stipend is recorded, staff service may be volunteer. Compensation changes do not alter your duty to follow this agreement and moderation standards.",
  },
  {
    heading: "Termination",
    body: "McGBot may suspend or remove staff access at any time for policy violations, inactivity, or operational needs. You may step down by notifying an admin. Upon termination, confidentiality and audit obligations survive.",
  },
  {
    heading: "Audit & accountability",
    body: "Your moderation actions may be logged on the dashboard and in server-side audit tables for quality review. You agree to use staff tools in good faith and accept that repeated low-quality or abusive decisions can result in removal from the program.",
  },
];

export function modHasSignedCurrentAgreement(input: {
  agreementVersion: string | null;
  agreementSignedAt: string | null;
}): boolean {
  if (!input.agreementSignedAt?.trim()) return false;
  return input.agreementVersion === CURRENT_MOD_AGREEMENT_VERSION;
}
