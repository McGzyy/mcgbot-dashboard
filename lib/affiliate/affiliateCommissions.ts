import { getAffiliateById } from "@/lib/affiliate/affiliateDb";
import { getAffiliateIdForReferredUser } from "@/lib/affiliate/affiliateAttribution";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function recordAffiliateCommissionFromPaidPayment(input: {
  referredUserId: string;
  idempotencyKey: string;
  paymentAmountCents: number;
  source: string;
  stripeInvoiceId?: string | null;
}): Promise<{ ok: true; recorded: boolean } | { ok: false; error: string }> {
  const referred = input.referredUserId.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  const amountPaidCents = Math.floor(input.paymentAmountCents);
  if (!referred || !idempotencyKey) return { ok: false, error: "missing_input" };
  if (!Number.isFinite(amountPaidCents) || amountPaidCents <= 0) {
    return { ok: false, error: "invalid_amount" };
  }

  const affiliateId = await getAffiliateIdForReferredUser(referred);
  if (!affiliateId) return { ok: true, recorded: false };

  const account = await getAffiliateById(affiliateId);
  if (!account || account.status !== "active") return { ok: true, recorded: false };

  const commissionCents = Math.floor((amountPaidCents * account.commissionRateBps) / 10_000);
  if (commissionCents <= 0) return { ok: true, recorded: false };

  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "database_unavailable" };

  const { error } = await db.from("affiliate_commissions").insert({
    affiliate_id: affiliateId,
    referred_user_id: referred,
    payment_amount_cents: amountPaidCents,
    commission_cents: commissionCents,
    status: "pending",
    source: input.source,
    stripe_invoice_id: input.stripeInvoiceId?.trim() || null,
    idempotency_key: idempotencyKey,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") return { ok: true, recorded: false };
    console.error("[affiliateCommissions] insert", error);
    return { ok: false, error: "insert_failed" };
  }

  return { ok: true, recorded: true };
}

export async function recordAffiliateCommissionFromStripeInvoice(input: {
  referredDiscordId: string;
  stripeInvoiceId: string;
  amountPaidCents: number;
}): Promise<{ ok: true; recorded: boolean } | { ok: false; error: string }> {
  const inv = input.stripeInvoiceId.trim();
  if (!inv) return { ok: false, error: "missing_invoice" };
  return recordAffiliateCommissionFromPaidPayment({
    referredUserId: input.referredDiscordId,
    idempotencyKey: `stripe_invoice:${inv}`,
    paymentAmountCents: Math.floor(input.amountPaidCents),
    source: "stripe_invoice_paid",
    stripeInvoiceId: inv,
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
