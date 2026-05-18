import {
  annualSignupBonusCents,
  commissionRateBpsForPaymentIndex,
} from "@/lib/affiliate/affiliateCommissionSchedule";
import { evaluateAffiliateMilestones } from "@/lib/affiliate/affiliateMilestones";
import { getAffiliateById } from "@/lib/affiliate/affiliateDb";
import { incrementReferralPaymentCount } from "@/lib/affiliate/affiliateReferralLedger";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

async function insertCommissionRow(input: {
  affiliateId: string;
  referredUserId: string | null;
  paymentAmountCents: number | null;
  commissionCents: number;
  commissionRateBps: number | null;
  paymentIndex: number | null;
  kind: "revshare" | "annual_signup_bonus" | "milestone";
  source: string;
  stripeInvoiceId?: string | null;
  idempotencyKey: string;
}): Promise<{ ok: true; recorded: boolean } | { ok: false; error: string }> {
  if (input.commissionCents <= 0) return { ok: true, recorded: false };

  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "database_unavailable" };

  const { error } = await db.from("affiliate_commissions").insert({
    affiliate_id: input.affiliateId,
    referred_user_id: input.referredUserId,
    payment_amount_cents: input.paymentAmountCents,
    commission_cents: input.commissionCents,
    commission_rate_bps: input.commissionRateBps,
    payment_index: input.paymentIndex,
    kind: input.kind,
    status: "pending",
    source: input.source,
    stripe_invoice_id: input.stripeInvoiceId?.trim() || null,
    idempotency_key: input.idempotencyKey,
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
  paymentAmountCents: number;
  source: string;
  stripeInvoiceId?: string | null;
  planId?: string | null;
}): Promise<{ ok: true; recorded: boolean } | { ok: false; error: string }> {
  const referred = input.referredUserId.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  const amountPaidCents = Math.floor(input.paymentAmountCents);
  if (!referred || !idempotencyKey) return { ok: false, error: "missing_input" };
  if (!Number.isFinite(amountPaidCents) || amountPaidCents <= 0) {
    return { ok: false, error: "invalid_amount" };
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
  const rateBps = commissionRateBpsForPaymentIndex(paymentIndex);
  let anyRecorded = false;

  if (rateBps != null) {
    const commissionCents = Math.floor((amountPaidCents * rateBps) / 10_000);
    const rev = await insertCommissionRow({
      affiliateId,
      referredUserId: referred,
      paymentAmountCents: amountPaidCents,
      commissionCents,
      commissionRateBps: rateBps,
      paymentIndex,
      kind: "revshare",
      source: input.source,
      stripeInvoiceId: input.stripeInvoiceId,
      idempotencyKey,
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
  planId?: string | null;
}): Promise<{ ok: true; recorded: boolean } | { ok: false; error: string }> {
  const inv = input.stripeInvoiceId.trim();
  if (!inv) return { ok: false, error: "missing_invoice" };
  return recordAffiliateCommissionFromPaidPayment({
    referredUserId: input.referredDiscordId,
    idempotencyKey: `stripe_invoice:${inv}`,
    paymentAmountCents: Math.floor(input.amountPaidCents),
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
};

export async function listAffiliateCommissionsForAdmin(
  limit = 200
): Promise<AffiliateCommissionAdminRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const lim = Math.min(500, Math.max(1, limit));
  const { data, error } = await db
    .from("affiliate_commissions")
    .select(
      "id, affiliate_id, referred_user_id, payment_amount_cents, commission_cents, payment_index, kind, status, source, stripe_invoice_id, created_at"
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
    base.push({
      id,
      affiliateId,
      referredUserId: typeof raw.referred_user_id === "string" ? raw.referred_user_id : null,
      paymentAmountCents:
        raw.payment_amount_cents == null ? null : Math.floor(Number(raw.payment_amount_cents)),
      commissionCents: Math.floor(Number(raw.commission_cents)) || 0,
      paymentIndex:
        raw.payment_index == null ? null : Math.floor(Number(raw.payment_index)),
      kind: typeof raw.kind === "string" ? raw.kind : "revshare",
      status: typeof raw.status === "string" ? raw.status : "",
      source: typeof raw.source === "string" ? raw.source : null,
      stripeInvoiceId: typeof raw.stripe_invoice_id === "string" ? raw.stripe_invoice_id : null,
      createdAt: typeof raw.created_at === "string" ? raw.created_at : "",
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
