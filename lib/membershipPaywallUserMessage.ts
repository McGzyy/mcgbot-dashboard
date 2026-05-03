/**
 * Maps membership / checkout API responses to short, actionable copy for /membership.
 * Prefer `code` from JSON when present; fall back to HTTP status and message heuristics.
 */
export type MembershipPaywallErrorContext =
  | "stripe_checkout"
  | "stripe_test_checkout"
  | "stripe_verify_session"
  | "complimentary_redeem"
  | "sol_start"
  | "sol_confirm";

export type MembershipApiErrorPayload = {
  error?: unknown;
  code?: unknown;
};

const BY_CODE: Record<string, string> = {
  maintenance: "Checkout is paused during maintenance. Try again when the site is open.",
  signups_paused: "New memberships are temporarily paused. Check Discord for updates, or try again later.",
  discord_guild_required: "Join the McGBot Discord server first (use the invite on this page), then refresh and try again.",
  discord_guild_check_failed:
    "We could not verify your Discord server membership. If you are already in the server, wait a minute and refresh; otherwise staff may need to check bot configuration.",
  pending_invoice:
    "You already have a pending SOL checkout. Pay it in your wallet, or wait about 20 minutes for the quote to expire, then start again.",
  quote_expired: "That SOL price quote expired. Click Pay with SOL again for a fresh quote.",
  quote_failed: "Could not load the SOL price. Wait a moment and try again.",
  test_checkout_disabled: "Test checkouts are turned off in admin settings.",
  missing_test_stripe_price: "Test checkout is missing a valid Stripe Price ID in Site admin (price_…).",
  test_plan_missing: "Test checkout could not resolve a plan. Set the test plan UUID in Site admin or ensure a monthly plan exists.",
  missing_stripe_price: "This plan is not linked to Stripe yet (missing price in the database). Contact support.",
  checkout_failed: "Checkout could not be started. If this keeps happening, check Stripe or contact support.",
  missing_treasury: "SOL payments are not configured on the server yet.",
  bad_treasury: "SOL treasury address on the server is invalid. Contact support.",
  voucher_use_complimentary_flow:
    "That kind of code is not used on the green Stripe button. Use “Have a 100% off code?” below, or a Stripe promotion code on Stripe’s checkout page.",
  use_stripe: "That code is not a full complimentary code. Use a Stripe promotion code at card checkout, or pick a 100% off staff code.",
  peek_voucher_missing: "The server is missing a database migration for vouchers. Contact support.",
  supabase_env: "Server database is not configured. If you run this app locally, check Supabase env vars and restart.",
  voucher_not_found: "That code was not found. Check spelling and try again.",
  voucher_inactive: "That voucher is inactive.",
  voucher_expired: "That voucher has expired.",
  voucher_exhausted: "That voucher has no uses left.",
  voucher_wrong_plan: "That code does not apply to the plan you selected.",
  voucher_error: "That code could not be applied.",
  voucher_missing: "Enter a code first.",
  plan_missing: "Pick a plan first.",
  checkout_not_complete: "Stripe is still finalizing checkout. Wait a few seconds and refresh, or try Verify again.",
  not_paid: "Stripe does not show this checkout as paid yet. Wait a moment and refresh the page.",
  missing_period_end:
    "Payment went through, but we could not read the subscription dates from Stripe yet. Refresh in a few seconds; if it persists, contact support.",
  subscription_not_ready: "Stripe subscription is not ready yet. Wait a few seconds and refresh.",
  missing_metadata: "Checkout metadata looks wrong. Contact support with your session id.",
  missing_subscription: "Stripe did not return a subscription for this session. Contact support.",
  missing_subscription_id: "Stripe subscription id is missing. Contact support.",
  retrieve_failed: "Could not load subscription details from Stripe. Try again shortly.",
  stripe_not_configured: "Stripe is not configured on the server.",
  subscription_update_failed: "Payment was seen but we could not update your access. Contact support.",
  unsupported_mode: "This checkout type is not supported here.",
  bad_duration: "Plan duration in checkout metadata is invalid. Contact support.",
  bad_expected_amount: "Checkout amount metadata is invalid. Contact support.",
  amount_mismatch: "Paid amount does not match the expected plan price. Contact support.",
  database_not_configured: "Server database is not configured.",
  missing_stripe_checkout_applied_table: "Server is missing a required database table. Contact support.",
  idempotency_failed: "Could not record this checkout safely. Contact support.",
  invoice_not_pending: "That SOL invoice is no longer pending. Start checkout again.",
  onchain_verify_failed:
    "We could not verify that transaction on-chain. Confirm you sent SOL to the shown address and amount, then try again or paste the Solana Pay link.",
  payer_read_failed: "Could not read the payer from your transaction. Try again or contact support.",
  invoice_mark_failed: "That payment may already have been applied, or the invoice changed. Start a new SOL checkout.",
  plan_misconfigured: "Plan is misconfigured on the server. Contact support.",
  payment_confirm_failed: "Could not confirm that payment.",
  no_matching_invoice: "No matching pending SOL invoice. Start checkout again.",
  confirm_failed: "Could not confirm payment.",
  invalid_or_expired_session: "That Stripe session is invalid or expired. Start checkout again.",
  session_wrong_account: "That payment belongs to a different Discord account.",
  missing_session_id: "Stripe returned without a session id. Go back to checkout and try again.",
  unauthorized: "Sign in with Discord (top of this page), then try again.",
  missing_invoice_or_signature: "Something was missing when confirming SOL payment. Start checkout again.",
};

function heuristicMessage(rawErr: string, httpStatus: number): string | null {
  const e = rawErr.toLowerCase();
  if (httpStatus === 401 || e.includes("unauthorized")) {
    return "Sign in with Discord (top of this page), then try again.";
  }
  if (
    /join the mcgbot discord/i.test(rawErr) ||
    /join the.*discord server before/i.test(rawErr) ||
    /purchasing (a subscription|membership)/i.test(rawErr)
  ) {
    return BY_CODE.discord_guild_required;
  }
  if (/could not verify discord membership/i.test(rawErr)) {
    return BY_CODE.discord_guild_check_failed;
  }
  if (/quote expired/i.test(rawErr)) return BY_CODE.quote_expired;
  if (/pending sol checkout/i.test(rawErr) || /pending_invoice/i.test(rawErr)) return BY_CODE.pending_invoice;
  if (/new checkouts are temporarily paused/i.test(rawErr)) return BY_CODE.signups_paused;
  if (/paused during maintenance/i.test(rawErr)) return BY_CODE.maintenance;
  return null;
}

export function membershipPaywallUserMessage(
  httpStatus: number,
  payload: MembershipApiErrorPayload,
  context: MembershipPaywallErrorContext
): string {
  const code = typeof payload.code === "string" ? payload.code.trim() : "";
  const rawErr = typeof payload.error === "string" ? payload.error.trim() : "";

  if (code && BY_CODE[code]) return BY_CODE[code];

  const hint = heuristicMessage(rawErr, httpStatus);
  if (hint) return hint;

  if (rawErr) return rawErr;

  switch (context) {
    case "stripe_checkout":
      return "Could not start Stripe checkout. Try again or contact support.";
    case "stripe_test_checkout":
      return "Could not start test checkout. Check admin settings and try again.";
    case "stripe_verify_session":
      return "Could not verify payment yet. Refresh in a moment.";
    case "complimentary_redeem":
      return "Could not apply that code.";
    case "sol_start":
      return "Could not start SOL checkout.";
    case "sol_confirm":
      return "Payment may have sent, but confirmation failed. Use the Solana Pay link or contact support.";
    default:
      return "Something went wrong. Try again.";
  }
}
