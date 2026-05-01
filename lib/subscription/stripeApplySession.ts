import type Stripe from "stripe";

import { upsertSubscriptionAfterPayment } from "@/lib/subscription/subscriptionDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type StripeApplyResult = { ok: true } | { ok: false; error: string };

/**
 * Idempotent: webhook and verify-session may both run; duplicate webhooks are ignored.
 */
export async function applyPaidStripeCheckoutSession(session: Stripe.Checkout.Session): Promise<StripeApplyResult> {
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

  return { ok: true };
}
