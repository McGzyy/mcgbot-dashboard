import {
  capPerRefereeCents,
  listMonthlyPriceCents,
  refundWindowDays,
  REFERRAL_CREDIT_PERCENT,
} from "@/lib/referralPolicy";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** Ledger row type for a referee subscription payment we may reward later (policy TBD). */
export const REFERRAL_EVENT_KEY_SUBSCRIPTION_PAYMENT = "subscription_payment_qualifying";

export type ReferralRewardPublicSummary = {
  pendingQualifyingPayments: number;
  grantedLedgerRows: number;
  voidedLedgerRows: number;
  activePayingReferrals: number;
  legacyGrantedProDaysTotal: number;
  /** Spendable referral credit (USD cents). */
  balanceCents: number;
  /** Pending rows that will credit balance after refund window (sum of credit_cents). */
  pendingCreditCents: number;
};

async function getRefereeFirstPaidAtIso(db: NonNullable<ReturnType<typeof getSupabaseAdmin>>, referredUserId: string): Promise<string | null> {
  const rid = referredUserId.trim();
  if (!rid) return null;

  const candidates: number[] = [];
  const { data: cRows } = await db
    .from("membership_events")
    .select("created_at")
    .eq("discord_id", rid)
    .gt("amount_cents", 0)
    .order("created_at", { ascending: true })
    .limit(1);
  const c0 = cRows?.[0] as { created_at?: string } | undefined;
  if (c0?.created_at) {
    const t = Date.parse(c0.created_at);
    if (Number.isFinite(t)) candidates.push(t);
  }

  const { data: sRows } = await db
    .from("membership_events")
    .select("created_at")
    .eq("discord_id", rid)
    .gt("amount_sol", 0)
    .order("created_at", { ascending: true })
    .limit(1);
  const s0 = sRows?.[0] as { created_at?: string } | undefined;
  if (s0?.created_at) {
    const t = Date.parse(s0.created_at);
    if (Number.isFinite(t)) candidates.push(t);
  }

  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates)).toISOString();
}

async function sumCreditCentsForPairInWindow(
  db: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  ownerDiscordId: string,
  referredUserId: string,
  refereeFirstPaidAtIso: string,
  statuses: readonly ("pending" | "granted")[]
): Promise<number> {
  const anchor = Date.parse(refereeFirstPaidAtIso);
  if (!Number.isFinite(anchor)) return 0;
  const windowEnd = anchor + 730 * 86_400_000;
  const { data, error } = await db
    .from("referral_rewards")
    .select("credit_cents, created_at, status")
    .eq("owner_discord_id", ownerDiscordId.trim())
    .eq("referred_user_id", referredUserId.trim())
    .in("status", [...statuses]);
  if (error || !Array.isArray(data)) return 0;
  let sum = 0;
  for (const r of data as { credit_cents?: unknown; created_at?: unknown; status?: unknown }[]) {
    const st = typeof r.status === "string" ? r.status : "";
    if (!statuses.includes(st as "pending" | "granted")) continue;
    const c = Number(r.credit_cents);
    if (!Number.isFinite(c) || c <= 0) continue;
    const t = typeof r.created_at === "string" ? Date.parse(r.created_at) : NaN;
    if (!Number.isFinite(t)) continue;
    if (t >= anchor && t <= windowEnd) sum += Math.floor(c);
  }
  return sum;
}

/**
 * Apply web checkout attribution: last click at conversion overwrites Discord invite row.
 */
export async function upsertReferralFromWebAttribution(input: {
  referredUserId: string;
  ownerDiscordId: string;
}): Promise<boolean> {
  const referred = input.referredUserId.trim();
  const owner = input.ownerDiscordId.trim();
  if (!referred || !owner || referred === owner) return false;
  const db = getSupabaseAdmin();
  if (!db) return false;

  const joinedAt = Date.now();
  const { error } = await db.from("referrals").upsert(
    {
      owner_discord_id: owner,
      referred_user_id: referred,
      joined_at: joinedAt,
      attribution_source: "web_cookie_checkout",
    },
    { onConflict: "referred_user_id" }
  );
  if (error) {
    console.error("[referralRewards] upsertReferralFromWebAttribution", error);
    return false;
  }
  return true;
}

/**
 * Record a qualifying paid subscription payment for the referee (pending until refund window).
 * Idempotent via `referral_rewards.idempotency_key` or stripe_invoice_id unique index.
 */
export async function recordReferralAccrualFromPaidPayment(input: {
  referredUserId: string;
  idempotencyKey: string;
  paymentAmountCents: number;
  refereePeriodDays: number;
  source: string;
  stripeInvoiceId?: string | null;
}): Promise<{ ok: true; recorded: boolean } | { ok: false; error: string }> {
  const referredUserId = input.referredUserId.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  if (!referredUserId || !idempotencyKey) return { ok: false, error: "missing_ids" };

  const paymentAmountCents = Math.max(0, Math.floor(Number(input.paymentAmountCents)));
  if (!Number.isFinite(paymentAmountCents) || paymentAmountCents <= 0) return { ok: true, recorded: false };

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

  const owner = typeof (refRow as { owner_discord_id?: string })?.owner_discord_id === "string"
    ? String((refRow as { owner_discord_id: string }).owner_discord_id).trim()
    : "";
  if (!owner || owner === referredUserId) return { ok: true, recorded: false };

  let anchorIso = await getRefereeFirstPaidAtIso(db, referredUserId);
  if (!anchorIso) {
    anchorIso = new Date().toISOString();
  }
  const anchorMs = Date.parse(anchorIso);
  const windowEndMs = anchorMs + 730 * 86_400_000;
  if (Date.now() > windowEndMs) {
    return { ok: true, recorded: false };
  }

  const usedGranted = await sumCreditCentsForPairInWindow(db, owner, referredUserId, anchorIso, ["granted"]);
  const usedPending = await sumCreditCentsForPairInWindow(db, owner, referredUserId, anchorIso, ["pending"]);
  const cap = capPerRefereeCents();
  const room = Math.max(0, cap - usedGranted - usedPending);
  const rawCredit = Math.floor(paymentAmountCents * REFERRAL_CREDIT_PERCENT);
  const creditCents = Math.min(rawCredit, room);
  if (creditCents <= 0) return { ok: true, recorded: false };

  const days = refundWindowDays();
  const availableAt = new Date(Date.now() + days * 86_400_000).toISOString();

  const stripeInvoiceId =
    typeof input.stripeInvoiceId === "string" && input.stripeInvoiceId.trim().startsWith("in_")
      ? input.stripeInvoiceId.trim()
      : null;

  const row: Record<string, unknown> = {
    idempotency_key: idempotencyKey,
    owner_discord_id: owner,
    referred_user_id: referredUserId,
    reward_key: REFERRAL_EVENT_KEY_SUBSCRIPTION_PAYMENT,
    award_days: null,
    status: "pending",
    referee_period_days: periodDays,
    source: input.source,
    payment_amount_cents: paymentAmountCents,
    credit_cents: creditCents,
    available_at: availableAt,
    referee_first_paid_at: anchorIso,
    note: null,
  };
  if (stripeInvoiceId) {
    row.stripe_invoice_id = stripeInvoiceId;
  }

  const { error: insErr } = await db.from("referral_rewards").insert(row);
  if (insErr) {
    if (insErr.code === "23505") return { ok: true, recorded: false };
    console.error("[referralRewards] insert ledger", insErr);
    return { ok: false, error: "ledger_insert_failed" };
  }

  return { ok: true, recorded: true };
}

/** @deprecated use recordReferralAccrualFromPaidPayment */
export async function recordPendingReferralEventForPaidInvoice(input: {
  referredUserId: string;
  invoiceId: string;
  refereePeriodDays: number;
  source: "reconcile-subscriptions";
}): Promise<{ ok: true; recorded: boolean } | { ok: false; error: string }> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "db_not_configured" };

  let paymentCents = 0;
  const { data: inv, error: invErr } = await db
    .from("payment_invoices")
    .select("lamports, sol_usd")
    .eq("id", input.invoiceId.trim())
    .maybeSingle();
  if (!invErr && inv && typeof inv === "object") {
    const lamports = Number((inv as { lamports?: unknown }).lamports);
    const solUsd = Number((inv as { sol_usd?: unknown }).sol_usd);
    if (Number.isFinite(lamports) && lamports > 0 && Number.isFinite(solUsd) && solUsd > 0) {
      const sol = lamports / 1e9;
      paymentCents = Math.max(0, Math.round(sol * solUsd * 100));
    }
  }

  if (paymentCents <= 0) {
    const { data: plan } = await db
      .from("payment_invoices")
      .select("plan_id")
      .eq("id", input.invoiceId.trim())
      .maybeSingle();
    const planId = typeof (plan as { plan_id?: string })?.plan_id === "string" ? (plan as { plan_id: string }).plan_id : "";
    if (planId) {
      const { data: prow } = await db
        .from("subscription_plans")
        .select("price_usd, discount_percent")
        .eq("id", planId)
        .maybeSingle();
      if (prow && typeof prow === "object") {
        const list = Number((prow as { price_usd?: unknown }).price_usd);
        const pct = Math.max(0, Math.min(100, Number((prow as { discount_percent?: unknown }).discount_percent) || 0));
        if (Number.isFinite(list) && list > 0) {
          paymentCents = Math.round(list * (1 - pct / 100) * 100);
        }
      }
    }
  }

  return recordReferralAccrualFromPaidPayment({
    referredUserId: input.referredUserId,
    idempotencyKey: `paid_invoice:${input.invoiceId.trim()}`,
    paymentAmountCents: paymentCents,
    refereePeriodDays: input.refereePeriodDays,
    source: input.source,
    stripeInvoiceId: null,
  });
}

export async function recordReferralAccrualFromSolFinalize(input: {
  referredUserId: string;
  paymentInvoiceId: string;
  refereePeriodDays: number;
  amountSol: number;
  solQuoteUsd: number | null;
}): Promise<{ ok: true; recorded: boolean } | { ok: false; error: string }> {
  const sol = Math.max(0, Number(input.amountSol));
  const usd = Number(input.solQuoteUsd);
  const paymentCents =
    Number.isFinite(sol) && sol > 0 && Number.isFinite(usd) && usd > 0 ? Math.round(sol * usd * 100) : 0;
  if (paymentCents <= 0) {
    return recordPendingReferralEventForPaidInvoice({
      referredUserId: input.referredUserId,
      invoiceId: input.paymentInvoiceId,
      refereePeriodDays: input.refereePeriodDays,
      source: "reconcile-subscriptions",
    });
  }
  return recordReferralAccrualFromPaidPayment({
    referredUserId: input.referredUserId,
    idempotencyKey: `paid_invoice:${input.paymentInvoiceId.trim()}`,
    paymentAmountCents: paymentCents,
    refereePeriodDays: input.refereePeriodDays,
    source: "sol_finalize",
    stripeInvoiceId: null,
  });
}

export async function recordReferralAccrualFromStripeInvoice(input: {
  referredDiscordId: string;
  stripeInvoiceId: string;
  amountPaidCents: number;
  refereePeriodDays: number;
}): Promise<{ ok: true; recorded: boolean } | { ok: false; error: string }> {
  const inv = input.stripeInvoiceId.trim();
  if (!inv) return { ok: false, error: "missing_invoice" };
  return recordReferralAccrualFromPaidPayment({
    referredUserId: input.referredDiscordId,
    idempotencyKey: `stripe_invoice:${inv}`,
    paymentAmountCents: Math.floor(input.amountPaidCents),
    refereePeriodDays: input.refereePeriodDays,
    source: "stripe_invoice_paid",
    stripeInvoiceId: inv,
  });
}

export async function settleDueReferralCredits(): Promise<{ settled: number }> {
  const db = getSupabaseAdmin();
  if (!db) return { settled: 0 };
  const nowIso = new Date().toISOString();

  const { data: rows, error } = await db
    .from("referral_rewards")
    .select("id, owner_discord_id, credit_cents")
    .eq("status", "pending")
    .lte("available_at", nowIso)
    .not("credit_cents", "is", null)
    .gt("credit_cents", 0)
    .limit(200);
  if (error || !Array.isArray(rows)) {
    if (error) console.error("[referralRewards] settle select", error);
    return { settled: 0 };
  }

  let settled = 0;
  for (const r of rows as { id?: string; owner_discord_id?: string; credit_cents?: unknown }[]) {
    const id = typeof r.id === "string" ? r.id : "";
    const owner = typeof r.owner_discord_id === "string" ? r.owner_discord_id.trim() : "";
    const cents = Math.floor(Number(r.credit_cents));
    if (!id || !owner || !Number.isFinite(cents) || cents <= 0) continue;

    const { data: upd, error: upErr } = await db
      .from("referral_rewards")
      .update({ status: "granted", award_days: null })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");
    if (upErr) {
      console.error("[referralRewards] settle update row", upErr);
      continue;
    }
    if (!Array.isArray(upd) || upd.length === 0) {
      continue;
    }

    const { data: bal } = await db.from("referral_credit_balances").select("balance_cents").eq("discord_id", owner).maybeSingle();
    const prev = bal && typeof bal === "object" ? Math.floor(Number((bal as { balance_cents?: unknown }).balance_cents)) : 0;
    const next = (Number.isFinite(prev) ? prev : 0) + cents;

    const { error: balErr } = await db.from("referral_credit_balances").upsert(
      {
        discord_id: owner,
        balance_cents: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "discord_id" }
    );
    if (balErr) {
      console.error("[referralRewards] settle balance", balErr);
      await db.from("referral_rewards").update({ status: "pending" }).eq("id", id);
      continue;
    }
    settled += 1;
  }

  return { settled };
}

export async function getReferralCreditBalanceCents(ownerDiscordId: string): Promise<number> {
  const owner = ownerDiscordId.trim();
  if (!owner) return 0;
  const db = getSupabaseAdmin();
  if (!db) return 0;
  const { data, error } = await db
    .from("referral_credit_balances")
    .select("balance_cents")
    .eq("discord_id", owner)
    .maybeSingle();
  if (error || !data) return 0;
  const n = Math.floor(Number((data as { balance_cents?: unknown }).balance_cents));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function getReferralRewardSummaryForOwner(ownerDiscordId: string): Promise<ReferralRewardPublicSummary | null> {
  const owner = ownerDiscordId.trim();
  if (!owner) return null;

  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data: rewardRows, error: rwErr } = await db
    .from("referral_rewards")
    .select("status, award_days, credit_cents, available_at")
    .eq("owner_discord_id", owner);
  if (rwErr) {
    console.error("[referralRewards] list rewards", rwErr);
    return null;
  }

  let pendingQualifyingPayments = 0;
  let pendingCreditCents = 0;
  let grantedLedgerRows = 0;
  let voidedLedgerRows = 0;
  let legacyGrantedProDaysTotal = 0;

  if (Array.isArray(rewardRows)) {
    for (const r of rewardRows as {
      status?: unknown;
      award_days?: unknown;
      credit_cents?: unknown;
      available_at?: unknown;
    }[]) {
      const st = typeof r.status === "string" ? r.status.trim() : "";
      if (st === "pending") {
        pendingQualifyingPayments += 1;
        const c = Number(r.credit_cents);
        if (Number.isFinite(c) && c > 0) {
          pendingCreditCents += Math.floor(c);
        }
      } else if (st === "granted") {
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
        .map((r: { referred_user_id?: string }) => String(r?.referred_user_id ?? "").trim())
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

  const balanceCents = await getReferralCreditBalanceCents(owner);

  return {
    pendingQualifyingPayments,
    grantedLedgerRows,
    voidedLedgerRows,
    activePayingReferrals,
    legacyGrantedProDaysTotal,
    balanceCents,
    pendingCreditCents,
  };
}
