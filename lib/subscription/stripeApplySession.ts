import type Stripe from "stripe";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { insertMembershipEvent, upsertSubscriptionAfterPayment } from "@/lib/subscription/subscriptionDb";
import { getStripe } from "@/lib/subscription/stripeServer";
import {
  deleteStripeCheckoutApplied,
  insertStripeCheckoutAppliedIfNew,
  syncDiscordSubscriptionFromStripeSubscription,
} from "@/lib/subscription/stripeSubscriptionSync";
import { invalidateLiveDashboardAccessCache } from "@/lib/dashboardGate";
import { syncPremiumDiscordRoleAfterSubscriptionChange } from "@/lib/discordPremiumRole";

export type StripeApplyResult = { ok: true } | { ok: false; error: string };

/**
 * Idempotent: webhook and verify-session may both run; duplicate webhooks are ignored.
 */
export async function applyPaidStripeCheckoutSession(session: Stripe.Checkout.Session): Promise<StripeApplyResult> {
  if (session.mode === "subscription") {
    return applySubscriptionCheckoutSession(session);
  }

  if (session.mode !== "payment") {
    return { ok: false, error: "unsupported_mode" };
  }
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return { ok: false, error: "not_paid" };
  }

  const md = session.metadata ?? {};
  const discordId = typeof md.discord_id === "string" ? md.discord_id.trim() : "";
  const planId = typeof md.plan_id === "string" ? md.plan_id.trim() : "";
  const durationRaw = typeof md.duration_days === "string" ? md.duration_days.trim() : "";
  const priceCentsRaw = typeof md.price_cents === "string" ? md.price_cents.trim() : "";

  if (!discordId || !planId || !durationRaw || !priceCentsRaw) {
    return { ok: false, error: "missing_metadata" };
  }

  const durationDays = Math.floor(Number(durationRaw));
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    return { ok: false, error: "bad_duration" };
  }

  const expectedCents = Number(priceCentsRaw);
  if (!Number.isFinite(expectedCents) || expectedCents < 50) {
    return { ok: false, error: "bad_expected_amount" };
  }
  if (session.amount_total == null || session.amount_total !== expectedCents) {
    return { ok: false, error: "amount_mismatch" };
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return { ok: false, error: "database_not_configured" };
  }

  const { error: insErr } = await db.from("stripe_checkout_applied").insert({
    checkout_session_id: session.id,
    discord_id: discordId,
  });

  if (insErr) {
    if (insErr.code === "23505") {
      return { ok: true };
    }
    if (insErr.code === "42P01" || (typeof insErr.message === "string" && insErr.message.includes("does not exist"))) {
      return { ok: false, error: "missing_stripe_checkout_applied_table" };
    }
    return { ok: false, error: "idempotency_failed" };
  }

  const granted = await upsertSubscriptionAfterPayment({
    discordId,
    planId,
    durationDays,
  });
  if (!granted) {
    await db.from("stripe_checkout_applied").delete().eq("checkout_session_id", session.id);
    return { ok: false, error: "subscription_update_failed" };
  }

  await insertMembershipEvent({
    discordId,
    eventType: "stripe_checkout_one_time",
    planId,
    stripeCheckoutSessionId: session.id,
    amountCents: session.amount_total ?? null,
  });

  await syncPremiumDiscordRoleAfterSubscriptionChange(discordId);
  invalidateLiveDashboardAccessCache(discordId);

  return { ok: true };
}

async function applySubscriptionCheckoutSession(session: Stripe.Checkout.Session): Promise<StripeApplyResult> {
  if (session.status !== "complete") {
    return { ok: false, error: "checkout_not_complete" };
  }

  const md = session.metadata ?? {};
  const discordId = typeof md.discord_id === "string" ? md.discord_id.trim() : "";
  if (!discordId) {
    return { ok: false, error: "missing_metadata" };
  }

  const subRef = session.subscription;
  const subscriptionId =
    typeof subRef === "string" ? subRef.trim() : subRef && typeof subRef === "object" && "id" in subRef
      ? String((subRef as { id: string }).id).trim()
      : "";
  if (!subscriptionId) {
    return { ok: false, error: "missing_subscription" };
  }

  const gate = await insertStripeCheckoutAppliedIfNew({
    checkoutSessionId: session.id,
    discordId,
  });
  if (!gate.inserted) {
    if (gate.duplicate) {
      return { ok: true };
    }
    return { ok: false, error: gate.error };
  }

  const stripe = getStripe();
  if (!stripe) {
    await deleteStripeCheckoutApplied(session.id);
    return { ok: false, error: "stripe_not_configured" };
  }

  let subscription: Stripe.Subscription | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const st = subscription.status;
      if (st !== "incomplete" && st !== "incomplete_expired") {
        break;
      }
    } catch (e) {
      console.error("[stripe apply] retrieve subscription", subscriptionId, e);
      subscription = null;
      break;
    }
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  if (!subscription) {
    await deleteStripeCheckoutApplied(session.id);
    return { ok: false, error: "retrieve_failed" };
  }

  const synced = await syncDiscordSubscriptionFromStripeSubscription({ stripe, subscription });
  if (!synced.ok) {
    await deleteStripeCheckoutApplied(session.id);
    return { ok: false, error: synced.error };
  }

  const planIdMeta =
    typeof subscription.metadata?.plan_id === "string" ? subscription.metadata.plan_id.trim() : "";
  await insertMembershipEvent({
    discordId,
    eventType: "stripe_checkout_subscription",
    planId: planIdMeta || null,
    stripeCheckoutSessionId: session.id,
    stripeSubscriptionId: subscriptionId,
  });

  return { ok: true };
}
