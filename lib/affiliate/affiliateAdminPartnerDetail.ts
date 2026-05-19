import { ensureAffiliateReferralCode, getAffiliateById, type AffiliateAccountRow } from "@/lib/affiliate/affiliateDb";
import { listAffiliateCommissionsForAffiliate } from "@/lib/affiliate/affiliateCommissions";
import {
  getAffiliateMilestoneProgress,
  type MilestoneProgress,
} from "@/lib/affiliate/affiliateMilestones";
import {
  getAffiliatePayoutBalance,
  listAffiliatePayoutRequests,
  type AffiliatePayoutRequestRow,
} from "@/lib/affiliate/affiliatePayouts";
import { affiliateShortReferralUrl } from "@/lib/affiliate/affiliateTrackingLink";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type AffiliateCommissionSummary = {
  pendingCents: number;
  approvedCents: number;
  paidCents: number;
  voidedCents: number;
  rowCount: number;
  revshareCents: number;
  bonusCents: number;
  lifetimeCents: number;
};

export type AffiliateAttributionStats = {
  total: number;
  withPayment: number;
};

export type AffiliateAdminPartnerDetail = {
  account: AffiliateAccountRow;
  trackingLink: string | null;
  referralCount: number;
  attributionStats: AffiliateAttributionStats;
  commissionSummary: AffiliateCommissionSummary;
  payoutBalance: Awaited<ReturnType<typeof getAffiliatePayoutBalance>>;
  milestones: MilestoneProgress[];
  recentCommissions: Awaited<ReturnType<typeof listAffiliateCommissionsForAffiliate>>;
  recentPayouts: AffiliatePayoutRequestRow[];
};

async function getAttributionStats(affiliateId: string): Promise<AffiliateAttributionStats> {
  const db = getSupabaseAdmin();
  if (!db) return { total: 0, withPayment: 0 };
  const { data, error } = await db
    .from("affiliate_attributions")
    .select("payment_count")
    .eq("affiliate_id", affiliateId.trim());
  if (error || !Array.isArray(data)) return { total: 0, withPayment: 0 };
  let withPayment = 0;
  for (const r of data as { payment_count?: unknown }[]) {
    const n = Math.floor(Number(r.payment_count)) || 0;
    if (n >= 1) withPayment += 1;
  }
  return { total: data.length, withPayment };
}

async function getCommissionSummary(affiliateId: string): Promise<AffiliateCommissionSummary> {
  const summary: AffiliateCommissionSummary = {
    pendingCents: 0,
    approvedCents: 0,
    paidCents: 0,
    voidedCents: 0,
    rowCount: 0,
    revshareCents: 0,
    bonusCents: 0,
    lifetimeCents: 0,
  };
  const db = getSupabaseAdmin();
  if (!db) return summary;
  const { data, error } = await db
    .from("affiliate_commissions")
    .select("commission_cents, status, kind")
    .eq("affiliate_id", affiliateId.trim());
  if (error || !Array.isArray(data)) return summary;
  for (const r of data as { commission_cents?: unknown; status?: string; kind?: string }[]) {
    const c = Math.floor(Number(r.commission_cents)) || 0;
    if (c <= 0) continue;
    summary.rowCount += 1;
    const st = typeof r.status === "string" ? r.status : "";
    const kind = typeof r.kind === "string" ? r.kind : "revshare";
    if (st === "pending") summary.pendingCents += c;
    else if (st === "approved") summary.approvedCents += c;
    else if (st === "paid") summary.paidCents += c;
    else if (st === "voided") summary.voidedCents += c;
    if (st !== "voided") summary.lifetimeCents += c;
    if (kind === "revshare") summary.revshareCents += c;
    else if (st !== "voided") summary.bonusCents += c;
  }
  return summary;
}

export async function getAffiliateAdminPartnerDetail(
  affiliateId: string
): Promise<AffiliateAdminPartnerDetail | null> {
  const account = await getAffiliateById(affiliateId);
  if (!account) return null;

  const [
    commissionSummary,
    payoutBalance,
    milestones,
    recentCommissions,
    recentPayouts,
    attributionStats,
  ] = await Promise.all([
    getCommissionSummary(account.id),
    getAffiliatePayoutBalance(account.id),
    getAffiliateMilestoneProgress(account.id),
    listAffiliateCommissionsForAffiliate(account.id, 50),
    listAffiliatePayoutRequests(account.id, 25),
    getAttributionStats(account.id),
  ]);

  const referralCode =
    account.status === "active"
      ? account.referralCode ?? (await ensureAffiliateReferralCode(account.id))
      : null;
  const trackingLink = referralCode ? affiliateShortReferralUrl(referralCode) : null;

  return {
    account,
    trackingLink,
    referralCount: attributionStats.total,
    attributionStats,
    commissionSummary,
    payoutBalance,
    milestones,
    recentCommissions,
    recentPayouts,
  };
}
