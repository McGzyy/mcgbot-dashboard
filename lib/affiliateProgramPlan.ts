/**
 * Affiliate program (commission payouts, partner dashboard).
 * Foundation: /affiliate/login, mandatory TOTP, /admin/affiliates provisioning.
 * Not used by member referral credit.
 */

export const AFFILIATE_PROGRAM_REQUIREMENTS = {
  /** Affiliates sign in on a dedicated surface, not member Discord OAuth. */
  separateLogin: true as const,
  /** TOTP (or equivalent) required before dashboard or payout access. */
  mandatoryTwoFactor: true as const,
} as const;

/** Implementation guardrails — still apply as commission accrual grows. */
export const AFFILIATE_PROGRAM_BOUNDARIES = [
  "Do not extend member referral_rewards / referral_credit_balances for affiliate commission tiers.",
  "Use separate auth tables, sessions, and RLS policies from the member dashboard.",
  "Affiliate TOTP uses affiliate_accounts + affiliate_recovery_codes (not public.users).",
] as const;

/** Shipped in foundation milestone. */
export const AFFILIATE_PROGRAM_ROUTES = {
  partnerLogin: "/affiliate/login",
  partnerDashboard: "/affiliate/dashboard",
  adminProvision: "/admin/affiliates",
} as const;
