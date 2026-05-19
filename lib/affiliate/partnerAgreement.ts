/** Bump when affiliate agreement text changes — active affiliates must re-sign. */
export const CURRENT_PARTNER_AGREEMENT_VERSION = "2026-05-18-v1";

export const PARTNER_AGREEMENT_TITLE = "McGBot Affiliate Agreement";

export const PARTNER_AGREEMENT_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "Program overview",
    body: "You promote McGBot Terminal subscriptions using your assigned tracking link. You earn recurring commission on each referred member’s subscription payments (15% on their 1st payment, 25% on their 2nd, 15% on their 3rd–12th), plus separate milestone and annual-plan bonuses described in your affiliate resources. You are an independent contractor, not an employee of McGBot.",
  },
  {
    heading: "Promotion standards",
    body: "Do not make guaranteed profit claims, impersonate McGBot staff, bid on our brand keywords without approval, or use spam. Disclose that you earn commission when required by law. McGBot may suspend or terminate affiliates who harm the brand or violate Discord/platform rules.",
  },
  {
    heading: "Payouts & tax",
    body: "Commissions and bonuses are recorded in your affiliate ledger. Payout timing and methods will be communicated separately. You are responsible for any taxes on amounts paid to you.",
  },
  {
    heading: "Data & confidentiality",
    body: "Do not share non-public McGBot metrics, unreleased features, or other affiliates’ data. You may use approved brand assets from the affiliate resources section only.",
  },
];

/** Shown on the apply form before ops approval — not the binding affiliate agreement. */
export const APPLICATION_DRAFT_TERMS = [
  "Information you submit is reviewed manually; approval is not guaranteed.",
  "You must complete authenticator 2FA before accessing the affiliate portal.",
  "Commissions follow the published McGBot affiliate schedule; misrepresentation or spam can result in termination.",
  "You confirm you are at least 18 and legally able to enter promotional agreements in your jurisdiction.",
] as const;

export function partnerHasSignedCurrentAgreement(input: {
  agreementVersion: string | null;
  agreementSignedAt: string | null;
}): boolean {
  if (!input.agreementSignedAt?.trim()) return false;
  return input.agreementVersion === CURRENT_PARTNER_AGREEMENT_VERSION;
}
