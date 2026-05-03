import type Stripe from "stripe";

import { getPlanIdByStripeSubscriptionId, insertMembershipEvent } from "@/lib/subscription/subscriptionDb";

/**
 * Records a membership_events row for recurring Stripe subscription cycles.
 * Skips the first-cycle invoice (`subscription_create`) so we do not duplicate checkout.session.completed rows.
 * Idempotent: same Stripe Invoice id returns success (unique index + insertMembershipEvent 23505 handling).
 */
export async function tryInsertStripeSubscriptionRenewalMembershipEvent(opts: {
  stripe: Stripe;
  invoice: Stripe.Invoice;
}): Promise<void> {
  const inv = opts.invoice;
  if (inv.billing_reason !== "subscription_cycle") return;

  const subRef = (inv as unknown as { subscription?: string | Stripe.Subscription | null }).subscription;
  const subId =
    typeof subRef === "string"
      ? subRef.trim()
      : subRef && typeof subRef === "object" && !Array.isArray(subRef) && "id" in subRef
        ? String((subRef as { id: string }).id).trim()
        : "";
  if (!subId) return;

  let sub: Stripe.Subscription;
  try {
    sub = await opts.stripe.subscriptions.retrieve(subId);
  } catch {
    return;
  }

  const md = sub.metadata ?? {};
  const discordId = typeof md.discord_id === "string" ? md.discord_id.trim() : "";
  let planId = typeof md.plan_id === "string" ? md.plan_id.trim() : "";
  if (!discordId) return;
  if (!planId) {
    planId = (await getPlanIdByStripeSubscriptionId(subId)) ?? "";
  }
  if (!planId) return;

  const amountCents = typeof inv.amount_paid === "number" ? inv.amount_paid : 0;

  await insertMembershipEvent({
    discordId,
    eventType: "stripe_subscription_renewal",
    planId,
    stripeSubscriptionId: subId,
    stripeInvoiceId: inv.id,
    amountCents,
    metadata: {
      stripe_billing_reason: inv.billing_reason ?? null,
      stripe_invoice_status: inv.status ?? null,
    },
  });
}
