import { invalidateLiveDashboardAccessCache } from "@/lib/dashboardGate";
import { syncPremiumDiscordRoleAfterSubscriptionChange } from "@/lib/discordPremiumRole";
import { computeSubscriptionExempt } from "@/lib/subscriptionExemption";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { extendSubscriptionDays, getPlanBySlug } from "@/lib/subscription/subscriptionDb";
import { REFERRAL_EXEMPT_SEGMENT_REDEEM_CAP_MONTHS } from "@/lib/referralPolicy";

function planMonthsEquivalent(durationDays: number): number {
  const d = Math.max(1, Math.floor(durationDays));
  return Math.max(1, Math.round(d / 30));
}

function effectivePlanPriceCents(priceUsd: number, discountPercent: number): number {
  const list = Math.max(0, Number(priceUsd));
  const pct = Math.max(0, Math.min(100, Math.floor(Number(discountPercent) || 0)));
  return Math.round(list * (1 - pct / 100) * 100);
}

export async function resolveReferralRedemptionSegmentKey(discordId: string): Promise<{
  segmentKey: string;
  isExempt: boolean;
  exemptCapApplies: boolean;
}> {
  const id = discordId.trim();
  const exempt = await computeSubscriptionExempt(id);
  if (!exempt) {
    return { segmentKey: "paid_standard", isExempt: false, exemptCapApplies: false };
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return { segmentKey: "exempt:unknown", isExempt: true, exemptCapApplies: true };
  }
  const { data } = await db
    .from("subscription_exempt_allowlist")
    .select("exempt_until")
    .eq("discord_id", id)
    .maybeSingle();
  const until =
    data && typeof data === "object" && typeof (data as { exempt_until?: unknown }).exempt_until === "string"
      ? String((data as { exempt_until: string }).exempt_until).trim()
      : "";
  const key = until ? `exempt_allowlist:${until}` : "exempt_allowlist:lifetime";
  return { segmentKey: key, isExempt: true, exemptCapApplies: true };
}

export async function redeemReferralCreditForPlan(input: {
  discordId: string;
  planSlug: string;
}): Promise<
  | { ok: true; balanceCents: number; extendedDays: number; costCents: number }
  | { ok: false; error: string; code: string }
> {
  const discordId = input.discordId.trim();
  const planSlug = input.planSlug.trim().toLowerCase();
  if (!discordId || !planSlug) return { ok: false, error: "Missing fields", code: "bad_request" };

  const plan = await getPlanBySlug(planSlug);
  if (!plan) return { ok: false, error: "Unknown plan", code: "unknown_plan" };

  const costCents = effectivePlanPriceCents(
    plan.price_usd,
    Math.max(0, Math.min(100, Math.round(Number(plan.discount_percent) || 0)))
  );
  if (costCents <= 0) return { ok: false, error: "Invalid plan price", code: "plan_price" };

  const monthsEq = planMonthsEquivalent(plan.duration_days);

  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not configured", code: "db" };

  const { segmentKey, exemptCapApplies } = await resolveReferralRedemptionSegmentKey(discordId);
  if (exemptCapApplies) {
    const { data: seg } = await db
      .from("referral_redemption_segment_totals")
      .select("months_equivalent")
      .eq("discord_id", discordId)
      .eq("segment_key", segmentKey)
      .maybeSingle();
    const used = Number((seg as { months_equivalent?: unknown })?.months_equivalent);
    const prev = Number.isFinite(used) && used > 0 ? used : 0;
    if (prev + monthsEq > REFERRAL_EXEMPT_SEGMENT_REDEEM_CAP_MONTHS + 1e-9) {
      return {
        ok: false,
        error: `Referral credit can cover at most ${REFERRAL_EXEMPT_SEGMENT_REDEEM_CAP_MONTHS} months per exemption while you are on complimentary access.`,
        code: "exempt_segment_cap",
      };
    }
  }

  const { data: balRow } = await db
    .from("referral_credit_balances")
    .select("balance_cents")
    .eq("discord_id", discordId)
    .maybeSingle();
  const balance = Math.floor(Number((balRow as { balance_cents?: unknown })?.balance_cents));
  if (!Number.isFinite(balance) || balance < costCents) {
    return { ok: false, error: "Insufficient referral credit.", code: "insufficient" };
  }

  const extended = await extendSubscriptionDays({
    discordId,
    days: plan.duration_days,
    fallbackPlanId: plan.id,
  });
  if (!extended) {
    return { ok: false, error: "Could not extend subscription.", code: "extend_failed" };
  }

  const nextBal = balance - costCents;
  const { error: upBal } = await db
    .from("referral_credit_balances")
    .update({ balance_cents: nextBal, updated_at: new Date().toISOString() })
    .eq("discord_id", discordId);
  if (upBal) {
    console.error("[referralRedeem] balance update", upBal);
    return { ok: false, error: "Balance update failed", code: "balance_failed" };
  }

  if (exemptCapApplies) {
    const { data: existing } = await db
      .from("referral_redemption_segment_totals")
      .select("months_equivalent")
      .eq("discord_id", discordId)
      .eq("segment_key", segmentKey)
      .maybeSingle();
    const prevM = Number((existing as { months_equivalent?: unknown })?.months_equivalent);
    const base = Number.isFinite(prevM) && prevM > 0 ? prevM : 0;
    const { error: segErr } = await db.from("referral_redemption_segment_totals").upsert(
      {
        discord_id: discordId,
        segment_key: segmentKey,
        months_equivalent: base + monthsEq,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "discord_id,segment_key" }
    );
    if (segErr) {
      console.error("[referralRedeem] segment totals", segErr);
    }
  }

  await db.from("membership_events").insert({
    discord_id: discordId,
    event_type: "referral_credit_redeem",
    plan_id: plan.id,
    amount_cents: 0,
    metadata: { plan_slug: planSlug, cost_cents: costCents, extended_days: plan.duration_days },
  });

  invalidateLiveDashboardAccessCache(discordId);
  void syncPremiumDiscordRoleAfterSubscriptionChange(discordId);

  return { ok: true, balanceCents: nextBal, extendedDays: plan.duration_days, costCents };
}
