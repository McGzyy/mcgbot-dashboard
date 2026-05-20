import {
  annualSignupBonusCents,
  commissionEligibleAt,
  commissionRateBpsForReferralPayment,
  revshareRatePercentLabel,
} from "@/lib/affiliate/affiliateCommissionSchedule";
import { evaluateAffiliateMilestones } from "@/lib/affiliate/affiliateMilestones";
import { getAffiliateById } from "@/lib/affiliate/affiliateDb";
import { incrementReferralPaymentCount } from "@/lib/affiliate/affiliateReferralLedger";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

async function insertCommissionRow(input: {
  affiliateId: string;
  referredUserId: string | null;
  paymentAmountCents: number | null;
  commissionBasisCents?: number | null;
  stripeFeeCents?: number | null;
  commissionCents: number;
  commissionRateBps: number | null;
  paymentIndex: number | null;
  kind: "revshare" | "annual_signup_bonus" | "milestone";
  source: string;
  stripeInvoiceId?: string | null;
  idempotencyKey: string;
  billingInterval: "monthly" | "annual";
  eligibleAt: string;
}): Promise<{ ok: true; recorded: boolean } | { ok: false; error: string }> {
  if (input.commissionCents <= 0) return { ok: true, recorded: false };

  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "database_unavailable" };

  const { error } = await db.from("affiliate_commissions").insert({
    affiliate_id: input.affiliateId,
    referred_user_id: input.referredUserId,
    payment_amount_cents: input.paymentAmountCents,
    commission_basis_cents: input.commissionBasisCents ?? null,
    stripe_fee_cents: input.stripeFeeCents ?? null,
    commission_cents: input.commissionCents,
    commission_rate_bps: input.commissionRateBps,
    payment_index: input.paymentIndex,
    kind: input.kind,
    status: "pending",
    source: input.source,
    stripe_invoice_id: input.stripeInvoiceId?.trim() || null,
    idempotency_key: input.idempotencyKey,
    billing_interval: input.billingInterval,
    eligible_at: input.eligibleAt,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") return { ok: true, recorded: false };
    console.error("[affiliateCommissions] insert", error);
    return { ok: false, error: "insert_failed" };
  }

  return { ok: true, recorded: true };
}

export async function recordAffiliateCommissionFromPaidPayment(input: {
  referredUserId: string;
  idempotencyKey: string;
  /** Gross member payment (invoice total). */
  paymentAmountCents: number;
  /** Rev-share basis; defaults to paymentAmountCents when omitted. */
  commissionBasisCents?: number;
  stripeFeeCents?: number | null;
  source: string;
  stripeInvoiceId?: string | null;
  planId?: string | null;
}): Promise<{ ok: true; recorded: boolean } | { ok: false; error: string }> {
  const referred = input.referredUserId.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  const amountPaidCents = Math.floor(input.paymentAmountCents);
  const commissionBasisCents = Math.floor(
    input.commissionBasisCents != null ? input.commissionBasisCents : amountPaidCents
  );
  const stripeFeeCents =
    input.stripeFeeCents == null ? null : Math.max(0, Math.floor(input.stripeFeeCents));
  if (!referred || !idempotencyKey) return { ok: false, error: "missing_input" };
  if (!Number.isFinite(amountPaidCents) || amountPaidCents <= 0) {
    return { ok: false, error: "invalid_amount" };
  }
  if (!Number.isFinite(commissionBasisCents) || commissionBasisCents <= 0) {
    return { ok: false, error: "invalid_basis" };
  }

  const ledger = await incrementReferralPaymentCount({
    referredUserId: referred,
    planId: input.planId,
  });

  if (!ledger.ok) {
    if (ledger.reason === "not_attributed") return { ok: true, recorded: false };
    return { ok: false, error: "ledger_failed" };
  }

  const affiliateId = ledger.affiliateId;

  const account = await getAffiliateById(affiliateId);
  if (!account || account.status !== "active") return { ok: true, recorded: false };

  const paymentIndex = ledger.paymentIndex;
  const billingInterval = ledger.billingInterval;
  const paidAt = new Date();
  const eligibleAt = commissionEligibleAt(paidAt, billingInterval);
  const rateBps = commissionRateBpsForReferralPayment({ paymentIndex, billingInterval });
  let anyRecorded = false;

  if (rateBps != null) {
    const commissionCents = Math.floor((commissionBasisCents * rateBps) / 10_000);
    const rev = await insertCommissionRow({
      affiliateId,
      referredUserId: referred,
      paymentAmountCents: amountPaidCents,
      commissionBasisCents,
      stripeFeeCents,
      commissionCents,
      commissionRateBps: rateBps,
      paymentIndex,
      kind: "revshare",
      source: input.source,
      stripeInvoiceId: input.stripeInvoiceId,
      idempotencyKey,
      billingInterval,
      eligibleAt,
    });
    if (!rev.ok) return rev;
    if (rev.recorded) anyRecorded = true;
  }

  if (ledger.isFirstPayment && ledger.billingInterval === "annual") {
    const bonus = annualSignupBonusCents(ledger.productTier);
    const bonusRes = await insertCommissionRow({
      affiliateId,
      referredUserId: referred,
      paymentAmountCents: amountPaidCents,
      commissionCents: bonus,
      commissionRateBps: null,
      paymentIndex: 1,
      kind: "annual_signup_bonus",
      source: "annual_signup_bonus",
      stripeInvoiceId: input.stripeInvoiceId,
      idempotencyKey: `${idempotencyKey}:annual_bonus`,
      billingInterval: "annual",
      eligibleAt: commissionEligibleAt(paidAt, "annual"),
    });
    if (!bonusRes.ok) return bonusRes;
    if (bonusRes.recorded) anyRecorded = true;
  }

  try {
    await evaluateAffiliateMilestones(affiliateId);
  } catch (e) {
    console.warn("[affiliateCommissions] milestone evaluate", e);
  }

  return { ok: true, recorded: anyRecorded };
}

export async function recordAffiliateCommissionFromStripeInvoice(input: {
  referredDiscordId: string;
  stripeInvoiceId: string;
  amountPaidCents: number;
  commissionBasisCents: number;
  stripeFeeCents?: number | null;
  planId?: string | null;
}): Promise<{ ok: true; recorded: boolean } | { ok: false; error: string }> {
  const inv = input.stripeInvoiceId.trim();
  if (!inv) return { ok: false, error: "missing_invoice" };
  return recordAffiliateCommissionFromPaidPayment({
    referredUserId: input.referredDiscordId,
    idempotencyKey: `stripe_invoice:${inv}`,
    paymentAmountCents: Math.floor(input.amountPaidCents),
    commissionBasisCents: Math.floor(input.commissionBasisCents),
    stripeFeeCents: input.stripeFeeCents,
    source: "stripe_invoice_paid",
    stripeInvoiceId: inv,
    planId: input.planId,
  });
}

export async function voidAffiliateCommissionsForStripeInvoice(
  stripeInvoiceId: string
): Promise<{ voided: number }> {
  const inv = stripeInvoiceId.trim();
  if (!inv.startsWith("in_")) return { voided: 0 };

  const db = getSupabaseAdmin();
  if (!db) return { voided: 0 };

  const { data: rows, error } = await db
    .from("affiliate_commissions")
    .select("id, status")
    .eq("stripe_invoice_id", inv)
    .in("status", ["pending", "approved"]);
  if (error || !Array.isArray(rows) || rows.length === 0) {
    if (error) console.error("[affiliateCommissions] void select", error);
    return { voided: 0 };
  }

  let voided = 0;
  for (const r of rows as { id?: string }[]) {
    const id = typeof r.id === "string" ? r.id : "";
    if (!id) continue;
    const { data: upd, error: upErr } = await db
      .from("affiliate_commissions")
      .update({ status: "voided", updated_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", ["pending", "approved"])
      .select("id");
    if (!upErr && Array.isArray(upd) && upd.length > 0) voided += 1;
  }

  return { voided };
}

export type AffiliateCommissionAdminRow = {
  id: string;
  affiliateId: string;
  affiliateEmail: string | null;
  referredUserId: string | null;
  paymentAmountCents: number | null;
  commissionCents: number;
  paymentIndex: number | null;
  kind: string;
  status: string;
  source: string | null;
  stripeInvoiceId: string | null;
  createdAt: string;
  description: string;
};

export type AffiliateCommissionPartnerRow = {
  id: string;
  commissionCents: number;
  paymentAmountCents: number | null;
  commissionBasisCents: number | null;
  stripeFeeCents: number | null;
  paymentIndex: number | null;
  kind: string;
  status: string;
  billingInterval: "monthly" | "annual" | null;
  eligibleAt: string | null;
  createdAt: string;
  description: string;
};

export function affiliateCommissionPartnerDescription(input: {
  kind: string;
  paymentIndex: number | null;
  billingInterval: "monthly" | "annual" | null;
  commissionRateBps?: number | null;
}): string {
  const kind = input.kind;
  if (kind === "milestone") return "Milestone bonus";
  if (kind === "annual_signup_bonus") return "Annual plan signup bonus";
  if (kind === "revshare") {
    const n = input.paymentIndex;
    const rateLabel =
      input.commissionRateBps != null && input.commissionRateBps > 0
        ? revshareRatePercentLabel(input.commissionRateBps)
        : null;
    const interval =
      input.billingInterval === "annual"
        ? "annual"
        : input.billingInterval === "monthly"
          ? "monthly"
          : "subscription";
    if (n != null && n >= 1) {
      const base = `Recurring · ${interval} payment #${n}`;
      return rateLabel ? `${base} · ${rateLabel}` : base;
    }
    return rateLabel ? `Recurring commission · ${rateLabel}` : "Recurring commission";
  }
  return kind.replace(/_/g, " ");
}

export async function listAffiliateCommissionsForPartner(
  affiliateId: string,
  options?: { limit?: number; status?: string | null }
): Promise<AffiliateCommissionPartnerRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const lim = Math.min(200, Math.max(1, options?.limit ?? 100));
  let query = db
    .from("affiliate_commissions")
    .select(
      "id, payment_amount_cents, commission_basis_cents, stripe_fee_cents, commission_cents, commission_rate_bps, payment_index, kind, status, billing_interval, eligible_at, created_at"
    )
    .eq("affiliate_id", affiliateId.trim())
    .order("created_at", { ascending: false })
    .limit(lim);
  const statusFilter = options?.status?.trim();
  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }
  const { data, error } = await query;
  if (error || !Array.isArray(data)) {
    if (error) console.error("[affiliateCommissions] list for partner", error);
    return [];
  }
  const rows: AffiliateCommissionPartnerRow[] = [];
  for (const raw of data as Record<string, unknown>[]) {
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!id) continue;
    const kind = typeof raw.kind === "string" ? raw.kind : "revshare";
    const billingRaw = typeof raw.billing_interval === "string" ? raw.billing_interval : null;
    const billingInterval =
      billingRaw === "monthly" || billingRaw === "annual" ? billingRaw : null;
    const paymentIndex =
      raw.payment_index == null ? null : Math.floor(Number(raw.payment_index));
    const commissionRateBps =
      raw.commission_rate_bps == null ? null : Math.floor(Number(raw.commission_rate_bps));
    rows.push({
      id,
      commissionCents: Math.floor(Number(raw.commission_cents)) || 0,
      paymentAmountCents:
        raw.payment_amount_cents == null ? null : Math.floor(Number(raw.payment_amount_cents)),
      commissionBasisCents:
        raw.commission_basis_cents == null
          ? null
          : Math.floor(Number(raw.commission_basis_cents)),
      stripeFeeCents:
        raw.stripe_fee_cents == null ? null : Math.floor(Number(raw.stripe_fee_cents)),
      paymentIndex,
      kind,
      status: typeof raw.status === "string" ? raw.status : "",
      billingInterval,
      eligibleAt: typeof raw.eligible_at === "string" ? raw.eligible_at : null,
      createdAt: typeof raw.created_at === "string" ? raw.created_at : "",
      description: affiliateCommissionPartnerDescription({
        kind,
        paymentIndex,
        billingInterval,
        commissionRateBps,
      }),
    });
  }
  return rows;
}

export async function listAffiliateCommissionsForAffiliate(
  affiliateId: string,
  limit = 50
): Promise<Omit<AffiliateCommissionAdminRow, "affiliateEmail">[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const lim = Math.min(200, Math.max(1, limit));
  const { data, error } = await db
    .from("affiliate_commissions")
    .select(
      "id, affiliate_id, referred_user_id, payment_amount_cents, commission_cents, commission_rate_bps, payment_index, kind, status, billing_interval, source, stripe_invoice_id, created_at"
    )
    .eq("affiliate_id", affiliateId.trim())
    .order("created_at", { ascending: false })
    .limit(lim);
  if (error || !Array.isArray(data)) {
    if (error) console.error("[affiliateCommissions] list for affiliate", error);
    return [];
  }
  const rows: Omit<AffiliateCommissionAdminRow, "affiliateEmail">[] = [];
  for (const raw of data as Record<string, unknown>[]) {
    const id = typeof raw.id === "string" ? raw.id : "";
    const aid = typeof raw.affiliate_id === "string" ? raw.affiliate_id : "";
    if (!id || !aid) continue;
    const kind = typeof raw.kind === "string" ? raw.kind : "revshare";
    const billingRaw = typeof raw.billing_interval === "string" ? raw.billing_interval : null;
    const billingInterval =
      billingRaw === "monthly" || billingRaw === "annual" ? billingRaw : null;
    const paymentIndex =
      raw.payment_index == null ? null : Math.floor(Number(raw.payment_index));
    const commissionRateBps =
      raw.commission_rate_bps == null ? null : Math.floor(Number(raw.commission_rate_bps));
    rows.push({
      id,
      affiliateId: aid,
      referredUserId: typeof raw.referred_user_id === "string" ? raw.referred_user_id : null,
      paymentAmountCents:
        raw.payment_amount_cents == null ? null : Math.floor(Number(raw.payment_amount_cents)),
      commissionCents: Math.floor(Number(raw.commission_cents)) || 0,
      paymentIndex,
      kind,
      status: typeof raw.status === "string" ? raw.status : "",
      source: typeof raw.source === "string" ? raw.source : null,
      stripeInvoiceId: typeof raw.stripe_invoice_id === "string" ? raw.stripe_invoice_id : null,
      createdAt: typeof raw.created_at === "string" ? raw.created_at : "",
      description: affiliateCommissionPartnerDescription({
        kind,
        paymentIndex,
        billingInterval,
        commissionRateBps,
      }),
    });
  }
  return rows;
}

export async function listAffiliateCommissionsForAdmin(
  limit = 200
): Promise<AffiliateCommissionAdminRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const lim = Math.min(500, Math.max(1, limit));
  const { data, error } = await db
    .from("affiliate_commissions")
    .select(
      "id, affiliate_id, referred_user_id, payment_amount_cents, commission_cents, commission_rate_bps, payment_index, kind, status, billing_interval, source, stripe_invoice_id, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(lim);
  if (error || !Array.isArray(data)) {
    if (error) console.error("[affiliateCommissions] admin list", error);
    return [];
  }
  const base: Omit<AffiliateCommissionAdminRow, "affiliateEmail">[] = [];
  for (const raw of data as Record<string, unknown>[]) {
    const id = typeof raw.id === "string" ? raw.id : "";
    const affiliateId = typeof raw.affiliate_id === "string" ? raw.affiliate_id : "";
    if (!id || !affiliateId) continue;
    const kind = typeof raw.kind === "string" ? raw.kind : "revshare";
    const billingRaw = typeof raw.billing_interval === "string" ? raw.billing_interval : null;
    const billingInterval =
      billingRaw === "monthly" || billingRaw === "annual" ? billingRaw : null;
    const paymentIndex =
      raw.payment_index == null ? null : Math.floor(Number(raw.payment_index));
    const commissionRateBps =
      raw.commission_rate_bps == null ? null : Math.floor(Number(raw.commission_rate_bps));
    base.push({
      id,
      affiliateId,
      referredUserId: typeof raw.referred_user_id === "string" ? raw.referred_user_id : null,
      paymentAmountCents:
        raw.payment_amount_cents == null ? null : Math.floor(Number(raw.payment_amount_cents)),
      commissionCents: Math.floor(Number(raw.commission_cents)) || 0,
      paymentIndex,
      kind,
      status: typeof raw.status === "string" ? raw.status : "",
      source: typeof raw.source === "string" ? raw.source : null,
      stripeInvoiceId: typeof raw.stripe_invoice_id === "string" ? raw.stripe_invoice_id : null,
      createdAt: typeof raw.created_at === "string" ? raw.created_at : "",
      description: affiliateCommissionPartnerDescription({
        kind,
        paymentIndex,
        billingInterval,
        commissionRateBps,
      }),
    });
  }
  const ids = [...new Set(base.map((r) => r.affiliateId))];
  const emailById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: accs, error: accErr } = await db
      .from("affiliate_accounts")
      .select("id, email")
      .in("id", ids);
    if (!accErr && Array.isArray(accs)) {
      for (const a of accs as { id?: string; email?: string }[]) {
        const aid = typeof a.id === "string" ? a.id : "";
        const em = typeof a.email === "string" ? a.email.trim().toLowerCase() : "";
        if (aid && em) emailById.set(aid, em);
      }
    }
  }
  return base.map((r) => ({
    ...r,
    affiliateEmail: emailById.get(r.affiliateId) ?? null,
  }));
}

export async function voidAffiliateCommissionById(commissionId: string): Promise<boolean> {
  const id = commissionId.trim();
  if (!id) return false;
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { data, error } = await db
    .from("affiliate_commissions")
    .update({ status: "voided", updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["pending", "approved"])
    .select("id");
  if (error || !Array.isArray(data) || data.length === 0) return false;
  return true;
}
