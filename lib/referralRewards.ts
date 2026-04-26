import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** Ledger row type for a referee subscription payment we may reward later (policy TBD). */
export const REFERRAL_EVENT_KEY_SUBSCRIPTION_PAYMENT = "subscription_payment_qualifying";

/**
 * Record a qualifying paid subscription invoice for the referee. Does not extend anyone's Pro time.
 * Idempotent via `referral_rewards.idempotency_key` (one row per invoice).
 */
export async function recordPendingReferralEventForPaidInvoice(input: {
  referredUserId: string;
  invoiceId: string;
  refereePeriodDays: number;
  source: "reconcile-subscriptions";
}): Promise<{ ok: true; recorded: boolean } | { ok: false; error: string }> {
  const referredUserId = input.referredUserId.trim();
  const invoiceId = input.invoiceId.trim();
  if (!referredUserId || !invoiceId) return { ok: false, error: "missing_ids" };

  const periodDays = Math.max(0, Math.floor(input.refereePeriodDays));
  if (!Number.isFinite(periodDays) || periodDays <= 0) return { ok: true, recorded: false };

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
  if (!ownerDiscordId) return { ok: true, recorded: false };
  if (ownerDiscordId === referredUserId) return { ok: true, recorded: false };

  const idempotencyKey = `paid_invoice:${invoiceId}`;

  const { error: insErr } = await db.from("referral_rewards").insert({
    idempotency_key: idempotencyKey,
    owner_discord_id: ownerDiscordId,
    referred_user_id: referredUserId,
    reward_key: REFERRAL_EVENT_KEY_SUBSCRIPTION_PAYMENT,
    award_days: null,
    status: "pending",
    referee_period_days: periodDays,
    source: input.source,
    source_invoice_id: invoiceId,
    note: null,
  });
  if (insErr) {
    if (insErr.code === "23505") return { ok: true, recorded: false };
    console.error("[referralRewards] insert ledger", insErr);
    return { ok: false, error: "ledger_insert_failed" };
  }

  return { ok: true, recorded: true };
}

export type ReferralRewardPublicSummary = {
  /** Qualifying paid-invoice events not yet tied to a reward policy. */
  pendingQualifyingPayments: number;
  /** Rows already settled under a prior policy (e.g. legacy auto Pro days). */
  grantedLedgerRows: number;
  voidedLedgerRows: number;
  activePayingReferrals: number;
  /** Sum of award_days on granted rows only (historical; not a promise of future value). */
  legacyGrantedProDaysTotal: number;
};

export async function getReferralRewardSummaryForOwner(ownerDiscordId: string): Promise<ReferralRewardPublicSummary | null> {
  const owner = ownerDiscordId.trim();
  if (!owner) return null;

  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data: rewardRows, error: rwErr } = await db
    .from("referral_rewards")
    .select("status, award_days")
    .eq("owner_discord_id", owner);
  if (rwErr) {
    console.error("[referralRewards] list rewards", rwErr);
    return null;
  }

  let pendingQualifyingPayments = 0;
  let grantedLedgerRows = 0;
  let voidedLedgerRows = 0;
  let legacyGrantedProDaysTotal = 0;

  if (Array.isArray(rewardRows)) {
    for (const r of rewardRows as { status?: unknown; award_days?: unknown }[]) {
      const st = typeof r.status === "string" ? r.status.trim() : "";
      if (st === "pending") pendingQualifyingPayments += 1;
      else if (st === "granted") {
        grantedLedgerRows += 1;
        const n = Number(r.award_days);
        if (Number.isFinite(n) && n > 0) legacyGrantedProDaysTotal += Math.floor(n);
      } else if (st === "voided") voidedLedgerRows += 1;
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

  return {
    pendingQualifyingPayments,
    grantedLedgerRows,
    voidedLedgerRows,
    activePayingReferrals,
    legacyGrantedProDaysTotal,
  };
}
