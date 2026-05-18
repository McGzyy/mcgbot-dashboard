import {
  milestoneBonusCents,
  milestoneTierRequiresSecondPayment,
  type MilestoneTier,
} from "@/lib/affiliate/affiliateCommissionSchedule";
import { getAffiliateById } from "@/lib/affiliate/affiliateDb";
import { isReferredUserSubscriptionActive } from "@/lib/affiliate/affiliateReferralLedger";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const TIER1_ACTIVE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

type AttributionRow = {
  referred_user_id: string;
  payment_count: number;
  first_paid_at: string | null;
};

async function listAttributionsForAffiliate(affiliateId: string): Promise<AttributionRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("affiliate_attributions")
    .select("referred_user_id, payment_count, first_paid_at")
    .eq("affiliate_id", affiliateId.trim());
  if (error || !Array.isArray(data)) {
    if (error) console.error("[affiliateMilestones] list attributions", error);
    return [];
  }
  return data.map((r) => ({
    referred_user_id: String((r as { referred_user_id?: string }).referred_user_id ?? ""),
    payment_count: Math.floor(Number((r as { payment_count?: unknown }).payment_count)) || 0,
    first_paid_at:
      typeof (r as { first_paid_at?: string }).first_paid_at === "string"
        ? (r as { first_paid_at: string }).first_paid_at
        : null,
  }));
}

async function qualifiesForTier1Active(row: AttributionRow, nowMs: number): Promise<boolean> {
  if (row.payment_count < 1 || !row.first_paid_at) return false;
  const firstMs = Date.parse(row.first_paid_at);
  if (!Number.isFinite(firstMs) || nowMs - firstMs < TIER1_ACTIVE_AFTER_MS) return false;
  return isReferredUserSubscriptionActive(row.referred_user_id);
}

async function qualifiesForRetentionActive(row: AttributionRow): Promise<boolean> {
  if (row.payment_count < 2) return false;
  return isReferredUserSubscriptionActive(row.referred_user_id);
}

export async function countMilestoneActives(
  affiliateId: string,
  tier: MilestoneTier
): Promise<number> {
  const rows = await listAttributionsForAffiliate(affiliateId);
  const nowMs = Date.now();
  const needsP2 = milestoneTierRequiresSecondPayment(tier);
  let n = 0;
  for (const row of rows) {
    if (!row.referred_user_id) continue;
    const ok = needsP2
      ? await qualifiesForRetentionActive(row)
      : await qualifiesForTier1Active(row, nowMs);
    if (ok) n += 1;
  }
  return n;
}

export type MilestoneProgress = {
  tier: MilestoneTier;
  threshold: number;
  activeCount: number;
  bonusCents: number;
  grantStatus: string | null;
  requiresSecondPayment: boolean;
};

export async function getAffiliateMilestoneProgress(
  affiliateId: string
): Promise<MilestoneProgress[]> {
  const db = getSupabaseAdmin();
  const tiers: MilestoneTier[] = [10, 25, 50];
  const grantByTier = new Map<number, string>();
  if (db) {
    const { data } = await db
      .from("affiliate_milestone_grants")
      .select("tier, status")
      .eq("affiliate_id", affiliateId.trim());
    if (Array.isArray(data)) {
      for (const g of data as { tier?: number; status?: string }[]) {
        const t = Math.floor(Number(g.tier));
        if (t === 10 || t === 25 || t === 50) {
          grantByTier.set(t, typeof g.status === "string" ? g.status : "");
        }
      }
    }
  }

  const out: MilestoneProgress[] = [];
  for (const tier of tiers) {
    out.push({
      tier,
      threshold: tier,
      activeCount: await countMilestoneActives(affiliateId, tier),
      bonusCents: milestoneBonusCents(tier),
      grantStatus: grantByTier.get(tier) ?? null,
      requiresSecondPayment: milestoneTierRequiresSecondPayment(tier),
    });
  }
  return out;
}

async function existingGrant(
  affiliateId: string,
  tier: MilestoneTier
): Promise<{ id: string; status: string } | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("affiliate_milestone_grants")
    .select("id, status")
    .eq("affiliate_id", affiliateId.trim())
    .eq("tier", tier)
    .maybeSingle();
  if (error || !data) return null;
  const id = typeof (data as { id?: string }).id === "string" ? (data as { id: string }).id : "";
  const status = typeof (data as { status?: string }).status === "string" ? (data as { status: string }).status : "";
  return id ? { id, status } : null;
}

async function insertMilestoneCommission(input: {
  affiliateId: string;
  amountCents: number;
  tier: MilestoneTier;
  idempotencyKey: string;
}): Promise<string | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("affiliate_commissions")
    .insert({
      affiliate_id: input.affiliateId,
      referred_user_id: null,
      payment_amount_cents: null,
      commission_cents: input.amountCents,
      commission_rate_bps: null,
      payment_index: null,
      kind: "milestone",
      status: "pending",
      source: `milestone_tier_${input.tier}`,
      idempotency_key: input.idempotencyKey,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: dup } = await db
        .from("affiliate_commissions")
        .select("id")
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();
      return typeof dup?.id === "string" ? dup.id : null;
    }
    console.error("[affiliateMilestones] commission insert", error);
    return null;
  }
  return typeof data?.id === "string" ? data.id : null;
}

/**
 * After payments or on cron: create milestone grants when thresholds are met.
 */
export async function evaluateAffiliateMilestones(affiliateId: string): Promise<void> {
  const id = affiliateId.trim();
  if (!id) return;
  const account = await getAffiliateById(id);
  if (!account || account.status !== "active") return;

  const tiers: MilestoneTier[] = [10, 25, 50];
  for (const tier of tiers) {
    const activeCount = await countMilestoneActives(id, tier);
    if (activeCount < tier) continue;

    const prior = await existingGrant(id, tier);
    if (prior) continue;

    const amountCents = milestoneBonusCents(tier);
    const idempotencyKey = `milestone:${id}:tier${tier}`;
    const commissionId = await insertMilestoneCommission({
      affiliateId: id,
      amountCents,
      tier,
      idempotencyKey,
    });

    const db = getSupabaseAdmin();
    if (!db) continue;

    const status = tier === 10 ? "auto_paid" : "pending_approval";
    const now = new Date().toISOString();
    const { error } = await db.from("affiliate_milestone_grants").insert({
      affiliate_id: id,
      tier,
      amount_cents: amountCents,
      qualified_active_count: activeCount,
      status,
      commission_id: commissionId,
      created_at: now,
      paid_at: tier === 10 ? now : null,
    });

    if (error && error.code !== "23505") {
      console.error("[affiliateMilestones] grant insert", error);
    }
  }
}

export async function approveMilestoneGrant(input: {
  grantId: string;
  reviewerDiscordId: string;
}): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("affiliate_milestone_grants")
    .update({
      status: "approved",
      reviewed_at: now,
      reviewed_by_discord_id: input.reviewerDiscordId.trim(),
    })
    .eq("id", input.grantId.trim())
    .eq("status", "pending_approval")
    .select("id");
  return !error && Array.isArray(data) && data.length > 0;
}

export async function listPendingMilestoneGrantsForAdmin(): Promise<
  {
    id: string;
    affiliateId: string;
    affiliateEmail: string | null;
    tier: number;
    amountCents: number;
    qualifiedActiveCount: number;
    createdAt: string;
  }[]
> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("affiliate_milestone_grants")
    .select("id, affiliate_id, tier, amount_cents, qualified_active_count, created_at")
    .eq("status", "pending_approval")
    .order("created_at", { ascending: true });
  if (error || !Array.isArray(data)) return [];

  const rows = data as {
    id?: string;
    affiliate_id?: string;
    tier?: number;
    amount_cents?: number;
    qualified_active_count?: number;
    created_at?: string;
  }[];

  const affiliateIds = [...new Set(rows.map((r) => r.affiliate_id).filter(Boolean))] as string[];
  const emailById = new Map<string, string>();
  if (affiliateIds.length > 0) {
    const { data: accs } = await db.from("affiliate_accounts").select("id, email").in("id", affiliateIds);
    if (Array.isArray(accs)) {
      for (const a of accs as { id?: string; email?: string }[]) {
        if (a.id && a.email) emailById.set(a.id, a.email);
      }
    }
  }

  return rows
    .map((r) => {
      const id = typeof r.id === "string" ? r.id : "";
      const affiliateId = typeof r.affiliate_id === "string" ? r.affiliate_id : "";
      if (!id || !affiliateId) return null;
      return {
        id,
        affiliateId,
        affiliateEmail: emailById.get(affiliateId) ?? null,
        tier: Math.floor(Number(r.tier)) || 0,
        amountCents: Math.floor(Number(r.amount_cents)) || 0,
        qualifiedActiveCount: Math.floor(Number(r.qualified_active_count)) || 0,
        createdAt: typeof r.created_at === "string" ? r.created_at : "",
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
}
