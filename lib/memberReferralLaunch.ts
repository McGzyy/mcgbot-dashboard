/**
 * Member referral v1 launch checklist (ops). Affiliate program is a separate phase.
 */

export const MEMBER_REFERRAL_LAUNCH_CHECKLIST = [
  "Apply Supabase migrations (referrals, referral_rewards, grants).",
  "Set CRON_SECRET on Vercel for referral-credit-settle and reconcile-subscriptions.",
  "Run node scripts/syncReferralsJsonToPostgres.js once on the bot host.",
  "Smoke: /ref/{slug} → Stripe or SOL checkout → hourly settle → redeem on Membership.",
  "Refund test: Stripe charge.refunded voids ledger; verify in /admin/referrals.",
] as const;
