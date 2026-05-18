import { getPlanById, type SubscriptionPlanRow } from "@/lib/subscription/subscriptionDb";
import { planProductTier } from "@/lib/subscription/subscriptionDb";
import { isAnnualPlanBilling } from "@/lib/affiliate/affiliateCommissionSchedule";
import type { ProductTier } from "@/lib/subscription/planTiers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type ReferralLedgerRow = {
  referredUserId: string;
  affiliateId: string;
  paymentCount: number;
  firstPaidAt: string | null;
  lastPaidAt: string | null;
  firstPlanProductTier: ProductTier | null;
  firstBillingInterval: "monthly" | "annual" | null;
};

function mapBillingInterval(plan: SubscriptionPlanRow | null): "monthly" | "annual" | null {
  if (!plan) return null;
  return isAnnualPlanBilling(plan.billing_months) ? "annual" : "monthly";
}

/**
 * Atomically increment payment count for an attributed referral.
 * Returns the new payment index (1-based) or null if not attributed.
 */
export async function incrementReferralPaymentCount(input: {
  referredUserId: string;
  planId?: string | null;
  paidAt?: Date;
}): Promise<
  | {
      ok: true;
      affiliateId: string;
      paymentIndex: number;
      productTier: ProductTier;
      billingInterval: "monthly" | "annual";
      isFirstPayment: boolean;
    }
  | { ok: false; reason: "not_attributed" | "db_error" }
> {
  const referred = input.referredUserId.trim();
  if (!referred) return { ok: false, reason: "not_attributed" };

  const db = getSupabaseAdmin();
  if (!db) return { ok: false, reason: "db_error" };

  const { data: existing, error: readErr } = await db
    .from("affiliate_attributions")
    .select(
      "affiliate_id, payment_count, first_paid_at, first_plan_product_tier, first_billing_interval"
    )
    .eq("referred_user_id", referred)
    .maybeSingle();

  if (readErr || !existing || typeof existing !== "object") {
    if (readErr) console.error("[affiliateReferralLedger] read", readErr);
    return { ok: false, reason: "not_attributed" };
  }

  const affiliateId =
    typeof (existing as { affiliate_id?: string }).affiliate_id === "string"
      ? (existing as { affiliate_id: string }).affiliate_id.trim()
      : "";
  if (!affiliateId) return { ok: false, reason: "not_attributed" };

  const prevCount = Math.floor(Number((existing as { payment_count?: unknown }).payment_count)) || 0;
  const paymentIndex = prevCount + 1;
  const paidAtIso = (input.paidAt ?? new Date()).toISOString();
  const isFirstPayment = prevCount === 0;

  let productTier: ProductTier =
    (existing as { first_plan_product_tier?: string }).first_plan_product_tier === "pro"
      ? "pro"
      : (existing as { first_plan_product_tier?: string }).first_plan_product_tier === "basic"
        ? "basic"
        : "basic";

  let billingInterval: "monthly" | "annual" =
    (existing as { first_billing_interval?: string }).first_billing_interval === "annual"
      ? "annual"
      : (existing as { first_billing_interval?: string }).first_billing_interval === "monthly"
        ? "monthly"
        : "monthly";

  if (isFirstPayment && input.planId?.trim()) {
    const plan = await getPlanById(input.planId.trim());
    if (plan) {
      productTier = planProductTier(plan);
      billingInterval = mapBillingInterval(plan) ?? "monthly";
    }
  }

  const patch: Record<string, unknown> = {
    payment_count: paymentIndex,
    last_paid_at: paidAtIso,
  };
  if (isFirstPayment) {
    patch.first_paid_at = paidAtIso;
    patch.first_plan_product_tier = productTier;
    patch.first_billing_interval = billingInterval;
  }

  const { error: upErr } = await db
    .from("affiliate_attributions")
    .update(patch)
    .eq("referred_user_id", referred);

  if (upErr) {
    console.error("[affiliateReferralLedger] update", upErr);
    return { ok: false, reason: "db_error" };
  }

  return {
    ok: true,
    affiliateId,
    paymentIndex,
    productTier,
    billingInterval,
    isFirstPayment,
  };
}

export async function isReferredUserSubscriptionActive(referredUserId: string): Promise<boolean> {
  const referred = referredUserId.trim();
  if (!referred) return false;
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { data, error } = await db
    .from("subscriptions")
    .select("current_period_end")
    .eq("discord_id", referred)
    .maybeSingle();
  if (error || !data?.current_period_end) return false;
  const end = new Date(String(data.current_period_end)).getTime();
  return Number.isFinite(end) && end > Date.now();
}
