import type Stripe from "stripe";

import { invalidateLiveDashboardAccessCache } from "@/lib/dashboardGate";
import { syncPremiumDiscordRoleAfterSubscriptionChange } from "@/lib/discordPremiumRole";
import {
  getPlanIdByStripeSubscriptionId,
  upsertSubscriptionFromStripe,
} from "@/lib/subscription/subscriptionDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type StripeSubscriptionSyncResult = { ok: true } | { ok: false; error: string };

const SKIP_SYNC = new Set(["incomplete", "incomplete_expired"]);

/**
 * Stripe Basil+ (2025-03-31) moved billing period to subscription items; older accounts still have
 * `subscription.current_period_end`. Support both so verify-session and webhooks can grant access.
 */
function subscriptionCurrentPeriodEndUnix(sub: Stripe.Subscription): number | null {
  const top = (sub as unknown as { current_period_end?: unknown }).current_period_end;
  if (typeof top === "number" && Number.isFinite(top) && top > 0) {
    return top;
  }
  const items = sub.items?.data;
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  let best: number | null = null;
  for (const it of items) {
    const end = (it as unknown as { current_period_end?: unknown }).current_period_end;
    if (typeof end === "number" && Number.isFinite(end) && end > 0) {
      if (best == null || end > best) {
        best = end;
      }
    }
  }
  return best;
}

function customerIdFromSubscription(sub: Stripe.Subscription): string | null {
  const c = sub.customer;
  if (typeof c === "string" && c.trim()) return c.trim();
  if (c && typeof c === "object" && "id" in c && typeof (c as { id?: string }).id === "string") {
    return (c as { id: string }).id.trim() || null;
  }
  return null;
}

async function cancelOtherActiveSubsForDiscord(params: {
  stripe: Stripe;
  customerId: string;
  keepSubscriptionId: string;
  discordId: string;
}): Promise<void> {
  const list = await params.stripe.subscriptions.list({
    customer: params.customerId,
    status: "active",
    limit: 30,
  });
  for (const other of list.data) {
    if (other.id === params.keepSubscriptionId) continue;
    const md = (other.metadata?.discord_id ?? "").trim();
    if (md !== params.discordId.trim()) continue;
    try {
      await params.stripe.subscriptions.cancel(other.id);
    } catch (e) {
      console.warn("[stripe sync] cancel duplicate subscription", other.id, e);
    }
  }
}

/**
 * Updates `subscriptions` from a Stripe Subscription object (renewals, cancellations, first payment).
 */
export async function syncDiscordSubscriptionFromStripeSubscription(params: {
  stripe: Stripe;
  subscription: Stripe.Subscription;
}): Promise<StripeSubscriptionSyncResult> {
  const sub = params.subscription;
  if (SKIP_SYNC.has(sub.status)) {
    return { ok: false, error: "subscription_not_ready" };
  }

  const md = sub.metadata ?? {};
  const discordId = typeof md.discord_id === "string" ? md.discord_id.trim() : "";
  let planId = typeof md.plan_id === "string" ? md.plan_id.trim() : "";
  if (!planId) {
    planId = (await getPlanIdByStripeSubscriptionId(sub.id)) ?? "";
  }
  if (!discordId || !planId) {
    return { ok: false, error: "missing_metadata" };
  }

  const endSec = subscriptionCurrentPeriodEndUnix(sub);
  if (endSec == null) {
    return { ok: false, error: "missing_period_end" };
  }
  const currentPeriodEndIso = new Date(endSec * 1000).toISOString();
  const customerId = customerIdFromSubscription(sub);

  const ok = await upsertSubscriptionFromStripe({
    discordId,
    planId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    currentPeriodEndIso,
    stripeStatus: sub.status,
  });
  if (!ok) {
    return { ok: false, error: "subscription_update_failed" };
  }

  if (customerId) {
    await cancelOtherActiveSubsForDiscord({
      stripe: params.stripe,
      customerId,
      keepSubscriptionId: sub.id,
      discordId,
    });
  }

  invalidateLiveDashboardAccessCache(discordId);
  await syncPremiumDiscordRoleAfterSubscriptionChange(discordId);
  return { ok: true };
}

export async function syncDiscordSubscriptionFromStripeId(params: {
  stripe: Stripe;
  subscriptionId: string;
}): Promise<StripeSubscriptionSyncResult> {
  const id = params.subscriptionId.trim();
  if (!id) return { ok: false, error: "missing_subscription_id" };
  try {
    const sub = await params.stripe.subscriptions.retrieve(id);
    return syncDiscordSubscriptionFromStripeSubscription({ stripe: params.stripe, subscription: sub });
  } catch (e) {
    console.error("[stripe sync] retrieve subscription", id, e);
    return { ok: false, error: "retrieve_failed" };
  }
}

/**
 * Idempotent guard for Checkout Session application (verify-session + webhook).
 */
export async function insertStripeCheckoutAppliedIfNew(input: {
  checkoutSessionId: string;
  discordId: string;
}): Promise<{ inserted: true } | { inserted: false; duplicate: boolean; error: string }> {
  const db = getSupabaseAdmin();
  if (!db) {
    return { inserted: false, duplicate: false, error: "database_not_configured" };
  }
  const { error: insErr } = await db.from("stripe_checkout_applied").insert({
    checkout_session_id: input.checkoutSessionId,
    discord_id: input.discordId.trim(),
  });
  if (!insErr) {
    return { inserted: true };
  }
  if (insErr.code === "23505") {
    return { inserted: false, duplicate: true, error: "duplicate" };
  }
  if (insErr.code === "42P01" || (typeof insErr.message === "string" && insErr.message.includes("does not exist"))) {
    return { inserted: false, duplicate: false, error: "missing_stripe_checkout_applied_table" };
  }
  return { inserted: false, duplicate: false, error: "idempotency_failed" };
}

export async function deleteStripeCheckoutApplied(checkoutSessionId: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  await db.from("stripe_checkout_applied").delete().eq("checkout_session_id", checkoutSessionId);
}
