import { getDashboardAdminSettings } from "@/lib/dashboardAdminSettingsDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { extendSubscriptionDays, listActivePlans } from "@/lib/subscription/subscriptionDb";

/** Ledger row `reward_key` for any credited slice tied to a referee subscription payment. */
export const REFERRAL_REWARD_KEY_SUBSCRIPTION_PAYMENT = "pro_days_subscription_payment";

function divisorFromEnv(): number | null {
  const raw = (process.env.REFERRAL_CREDIT_DIVISOR ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const d = Math.floor(n);
  if (d < 1 || d > 60) return null;
  return d;
}

export async function getReferralCreditDivisor(): Promise<number> {
  const env = divisorFromEnv();
  if (env != null) return env;
  const row = await getDashboardAdminSettings();
  const d = row?.referral_credit_divisor;
  if (typeof d === "number" && Number.isFinite(d)) {
    const n = Math.floor(d);
    if (n >= 1 && n <= 60) return n;
  }
  return 5;
}

/** Pro days credited to referrer for one referee billing period of `durationDays`. */
export function computeReferralAwardDays(durationDays: number, divisor: number): number {
  const dur = Math.max(0, Math.floor(durationDays));
  const div = Math.max(1, Math.floor(divisor));
  if (dur <= 0) return 0;
  return Math.max(1, Math.floor(dur / div));
}

/**
 * When a referee completes a paid subscription invoice, credit the referrer a slice of that period.
 * Idempotent via `referral_rewards.idempotency_key` (one row per invoice).
 */
export async function maybeAwardReferralProCreditForPaidInvoice(input: {
  referredUserId: string;
  invoiceId: string;
  durationDays: number;
  planIdForFallback: string;
  source: "reconcile-subscriptions";
}): Promise<{ ok: true; awarded: boolean } | { ok: false; error: string }> {
  const referredUserId = input.referredUserId.trim();
  const invoiceId = input.invoiceId.trim();
  if (!referredUserId || !invoiceId) return { ok: false, error: "missing_ids" };

  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "db_not_configured" };

  const { data: refRow, error: refErr } = await db
    .from("referrals")
    .select("owner_discord_id, referred_user_id")
    .eq("referred_user_id", referredUserId)
    .limit(1)
    .maybeSingle();
  if (refErr) {
    console.error("[referralRewards] referrals lookup", refErr);
    return { ok: false, error: "referrals_lookup_failed" };
  }

  const owner = typeof (refRow as any)?.owner_discord_id === "string" ? String((refRow as any).owner_discord_id) : "";
  const ownerDiscordId = owner.trim();
  if (!ownerDiscordId) return { ok: true, awarded: false };
  if (ownerDiscordId === referredUserId) return { ok: true, awarded: false };

  const divisor = await getReferralCreditDivisor();
  const awardDays = computeReferralAwardDays(input.durationDays, divisor);
  if (awardDays <= 0) return { ok: true, awarded: false };

  const idempotencyKey = `paid_invoice:${invoiceId}`;

  const { error: insErr } = await db.from("referral_rewards").insert({
    idempotency_key: idempotencyKey,
    owner_discord_id: ownerDiscordId,
    referred_user_id: referredUserId,
    reward_key: REFERRAL_REWARD_KEY_SUBSCRIPTION_PAYMENT,
    award_days: awardDays,
    source: input.source,
    source_invoice_id: invoiceId,
    note: null,
  });
  if (insErr) {
    if (insErr.code === "23505") return { ok: true, awarded: false };
    console.error("[referralRewards] insert ledger", insErr);
    return { ok: false, error: "ledger_insert_failed" };
  }

  const extended = await extendSubscriptionDays({
    discordId: ownerDiscordId,
    days: awardDays,
    fallbackPlanId: input.planIdForFallback ?? null,
  });
  if (!extended) {
    return { ok: false, error: "extend_failed" };
  }

  return { ok: true, awarded: true };
}

export type ReferralRewardPublicSummary = {
  totalProDaysEarned: number;
  activePayingReferrals: number;
  creditDivisor: number;
  /** Example using the shortest active plan's duration (sorted like checkout). */
  examplePlanDurationDays: number | null;
  estimatedDaysPerReferralRenewal: number | null;
};

export async function getReferralRewardSummaryForOwner(ownerDiscordId: string): Promise<ReferralRewardPublicSummary | null> {
  const owner = ownerDiscordId.trim();
  if (!owner) return null;

  const db = getSupabaseAdmin();
  if (!db) return null;

  const divisor = await getReferralCreditDivisor();

  const { data: rewardRows, error: rwErr } = await db
    .from("referral_rewards")
    .select("award_days")
    .eq("owner_discord_id", owner);
  if (rwErr) {
    console.error("[referralRewards] sum rewards", rwErr);
    return null;
  }
  let totalProDaysEarned = 0;
  if (Array.isArray(rewardRows)) {
    for (const r of rewardRows as { award_days?: unknown }[]) {
      const n = Number(r?.award_days);
      if (Number.isFinite(n) && n > 0) totalProDaysEarned += Math.floor(n);
    }
  }

  const { data: refRows, error: refErr } = await db
    .from("referrals")
    .select("referred_user_id")
    .eq("owner_discord_id", owner);
  if (refErr) {
    console.error("[referralRewards] list referrals", refErr);
    return null;
  }
  const referredIds = Array.from(
    new Set(
      (Array.isArray(refRows) ? refRows : [])
        .map((r: any) => String(r?.referred_user_id ?? "").trim())
        .filter(Boolean)
    )
  );

  let activePayingReferrals = 0;
  const nowIso = new Date().toISOString();
  if (referredIds.length > 0) {
    const { data: subs, error: subErr } = await db
      .from("subscriptions")
      .select("discord_id, current_period_end")
      .in("discord_id", referredIds)
      .gt("current_period_end", nowIso);
    if (subErr) {
      console.error("[referralRewards] subscriptions batch", subErr);
    } else if (Array.isArray(subs)) {
      activePayingReferrals = subs.length;
    }
  }

  const plans = await listActivePlans();
  const firstPlan = plans[0];
  const examplePlanDurationDays =
    firstPlan && Number.isFinite(Number(firstPlan.duration_days))
      ? Math.max(1, Math.floor(Number(firstPlan.duration_days)))
      : null;
  const estimatedDaysPerReferralRenewal =
    examplePlanDurationDays != null && examplePlanDurationDays > 0
      ? computeReferralAwardDays(examplePlanDurationDays, divisor)
      : null;

  return {
    totalProDaysEarned,
    activePayingReferrals,
    creditDivisor: divisor,
    examplePlanDurationDays,
    estimatedDaysPerReferralRenewal,
  };
}
