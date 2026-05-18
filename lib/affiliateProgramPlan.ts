/**
 * Future affiliate program (commission payouts, partner dashboard).
 * Not used by member referral v1 — documents requirements before implementation.
 */

export const AFFILIATE_PROGRAM_REQUIREMENTS = {
  /** Affiliates sign in on a dedicated surface, not member Discord OAuth. */
  separateLogin: true as const,
  /** TOTP (or equivalent) required before dashboard or payout access. */
  mandatoryTwoFactor: true as const,
} as const;

/** Implementation guardrails when affiliate work starts. */
export const AFFILIATE_PROGRAM_BOUNDARIES = [
  "Do not extend member referral_rewards / referral_credit_balances for affiliate commission tiers.",
  "Use separate auth tables, sessions, and RLS policies from the member dashboard.",
  "Reuse users_totp_2fa patterns where possible, but scope credentials to affiliate accounts only.",
] as const;
