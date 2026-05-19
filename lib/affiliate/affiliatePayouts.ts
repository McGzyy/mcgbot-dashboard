import { getAffiliateById } from "@/lib/affiliate/affiliateDb";
import { queueAffiliatePayoutRequestOpsEmail, queueAffiliatePayoutStatusEmail } from "@/lib/affiliate/affiliateNotifications";
import { affiliatePayoutMethodConfigured } from "@/lib/affiliate/affiliatePayoutMethod";
import { AFFILIATE_PAYOUT_MIN_CENTS } from "@/lib/affiliate/affiliateSlugPolicy";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type AffiliatePayoutStatus = "pending" | "approved" | "paid" | "rejected";

export type AffiliatePayoutRequestRow = {
  id: string;
  affiliateId: string;
  amountCents: number;
  status: AffiliatePayoutStatus;
  partnerNote: string | null;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
};

function mapPayoutRow(data: Record<string, unknown>): AffiliatePayoutRequestRow | null {
  const id = typeof data.id === "string" ? data.id : "";
  const affiliateId = typeof data.affiliate_id === "string" ? data.affiliate_id : "";
  const status = data.status;
  if (!id || !affiliateId) return null;
  if (status !== "pending" && status !== "approved" && status !== "paid" && status !== "rejected") {
    return null;
  }
  return {
    id,
    affiliateId,
    amountCents: Math.floor(Number(data.amount_cents)) || 0,
    status,
    partnerNote: typeof data.partner_note === "string" ? data.partner_note.trim() : null,
    adminNote: typeof data.admin_note === "string" ? data.admin_note.trim() : null,
    createdAt: typeof data.created_at === "string" ? data.created_at : "",
    reviewedAt: typeof data.reviewed_at === "string" ? data.reviewed_at : null,
    paidAt: typeof data.paid_at === "string" ? data.paid_at : null,
  };
}

export async function sumApprovedCommissionCents(affiliateId: string): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return 0;
  const { data, error } = await db
    .from("affiliate_commissions")
    .select("commission_cents")
    .eq("affiliate_id", affiliateId.trim())
    .eq("status", "approved");
  if (error || !Array.isArray(data)) return 0;
  let total = 0;
  for (const r of data as { commission_cents?: unknown }[]) {
    total += Math.max(0, Math.floor(Number(r.commission_cents)) || 0);
  }
  return total;
}

export async function sumReservedPayoutCents(affiliateId: string): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return 0;
  const { data, error } = await db
    .from("affiliate_payout_requests")
    .select("amount_cents, status")
    .eq("affiliate_id", affiliateId.trim())
    .in("status", ["pending", "approved", "paid"]);
  if (error || !Array.isArray(data)) return 0;
  let total = 0;
  for (const r of data as { amount_cents?: unknown }[]) {
    total += Math.max(0, Math.floor(Number(r.amount_cents)) || 0);
  }
  return total;
}

export async function getAffiliatePayoutBalance(affiliateId: string): Promise<{
  approvedCents: number;
  reservedCents: number;
  availableCents: number;
  minRequestCents: number;
}> {
  const approvedCents = await sumApprovedCommissionCents(affiliateId);
  const reservedCents = await sumReservedPayoutCents(affiliateId);
  const availableCents = Math.max(0, approvedCents - reservedCents);
  return {
    approvedCents,
    reservedCents,
    availableCents,
    minRequestCents: AFFILIATE_PAYOUT_MIN_CENTS,
  };
}

export async function listAffiliatePayoutRequests(
  affiliateId: string,
  limit = 20
): Promise<AffiliatePayoutRequestRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("affiliate_payout_requests")
    .select(
      "id, affiliate_id, amount_cents, status, partner_note, admin_note, created_at, reviewed_at, paid_at"
    )
    .eq("affiliate_id", affiliateId.trim())
    .order("created_at", { ascending: false })
    .limit(Math.min(50, Math.max(1, limit)));
  if (error || !Array.isArray(data)) return [];
  return data
    .map((r) => mapPayoutRow(r as Record<string, unknown>))
    .filter((r): r is AffiliatePayoutRequestRow => Boolean(r));
}

export async function createAffiliatePayoutRequest(input: {
  affiliateId: string;
  amountCents: number;
  partnerNote?: string | null;
}): Promise<{ ok: true; request: AffiliatePayoutRequestRow } | { ok: false; error: string }> {
  const affiliateId = input.affiliateId.trim();
  const amountCents = Math.floor(Number(input.amountCents));
  if (!affiliateId || amountCents < AFFILIATE_PAYOUT_MIN_CENTS) {
    return {
      ok: false,
      error: `Minimum payout request is $${(AFFILIATE_PAYOUT_MIN_CENTS / 100).toFixed(0)}.`,
    };
  }

  const account = await getAffiliateById(affiliateId);
  if (!account) {
    return { ok: false, error: "Account not found." };
  }
  if (
    !affiliatePayoutMethodConfigured({
      payoutMethod: account.payoutMethod,
      payoutDestination: account.payoutDestination,
      payoutMethodUpdatedAt: account.payoutMethodUpdatedAt,
    })
  ) {
    return {
      ok: false,
      error: "Add your payout method in Settings before requesting a withdrawal.",
    };
  }

  const balance = await getAffiliatePayoutBalance(affiliateId);
  if (amountCents > balance.availableCents) {
    return { ok: false, error: "Amount exceeds available approved balance." };
  }

  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not configured." };

  const { data, error } = await db
    .from("affiliate_payout_requests")
    .insert({
      affiliate_id: affiliateId,
      amount_cents: amountCents,
      partner_note: input.partnerNote?.trim() || null,
      status: "pending",
    })
    .select(
      "id, affiliate_id, amount_cents, status, partner_note, admin_note, created_at, reviewed_at, paid_at"
    )
    .single();

  if (error) {
    console.error("[affiliatePayouts] create", error);
    return { ok: false, error: "Could not create payout request." };
  }

  const request = mapPayoutRow(data as Record<string, unknown>);
  if (!request) return { ok: false, error: "Could not read payout request." };
  queueAffiliatePayoutRequestOpsEmail({
    affiliateId: request.affiliateId,
    amountCents: request.amountCents,
    requestId: request.id,
    partnerNote: request.partnerNote,
  });
  return { ok: true, request };
}

export type AffiliatePayoutRequestAdminRow = AffiliatePayoutRequestRow & {
  affiliateEmail: string;
  payoutMethod: string | null;
  payoutDestination: string | null;
};

export async function listAllPayoutRequests(limit = 100): Promise<AffiliatePayoutRequestAdminRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("affiliate_payout_requests")
    .select(
      "id, affiliate_id, amount_cents, status, partner_note, admin_note, created_at, reviewed_at, paid_at, affiliate_accounts ( email, payout_method, payout_destination )"
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(200, Math.max(1, limit)));
  if (error || !Array.isArray(data)) return [];

  const out: AffiliatePayoutRequestAdminRow[] = [];
  for (const row of data) {
    const mapped = mapPayoutRow(row as Record<string, unknown>);
    if (!mapped) continue;
    const acct = (
      row as {
        affiliate_accounts?: {
          email?: string;
          payout_method?: string;
          payout_destination?: string;
        } | null;
      }
    ).affiliate_accounts;
    const email = typeof acct?.email === "string" ? acct.email : "";
    out.push({
      ...mapped,
      affiliateEmail: email,
      payoutMethod: typeof acct?.payout_method === "string" ? acct.payout_method : null,
      payoutDestination:
        typeof acct?.payout_destination === "string" ? acct.payout_destination : null,
    });
  }
  return out;
}

async function getAffiliatePayoutRequestById(
  requestId: string
): Promise<AffiliatePayoutRequestRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("affiliate_payout_requests")
    .select(
      "id, affiliate_id, amount_cents, status, partner_note, admin_note, created_at, reviewed_at, paid_at"
    )
    .eq("id", requestId.trim())
    .maybeSingle();
  if (error || !data) return null;
  return mapPayoutRow(data as Record<string, unknown>);
}

export async function updateAffiliatePayoutRequestStatus(input: {
  requestId: string;
  status: AffiliatePayoutStatus;
  adminNote?: string | null;
  reviewedByDiscordId?: string | null;
}): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const existing = await getAffiliatePayoutRequestById(input.requestId);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.status,
    reviewed_at: now,
    reviewed_by_discord_id: input.reviewedByDiscordId?.trim() || null,
  };
  if (input.adminNote !== undefined) {
    patch.admin_note = input.adminNote?.trim() || null;
  }
  if (input.status === "paid") {
    patch.paid_at = now;
  }

  const { error } = await db
    .from("affiliate_payout_requests")
    .update(patch)
    .eq("id", input.requestId.trim());
  if (error) return false;
  if (!existing) return false;

  if (input.status !== existing.status) {
    queueAffiliatePayoutStatusEmail({
      affiliateId: existing.affiliateId,
      amountCents: existing.amountCents,
      status: input.status,
      adminNote: input.adminNote,
    });
  }
  return true;
}
