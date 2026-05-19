import { countOpenPublicContactInquiries } from "@/lib/affiliate/affiliatePublicContactAdmin";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type AffiliateAdminOverviewStats = {
  pendingApplications: number;
  needsContactApplications: number;
  activePartners: number;
  suspendedPartners: number;
  openContactInquiries: number;
  commissionsPendingCents: number;
  commissionsLast30dCents: number;
  attributionRows: number;
};

export async function getAffiliateAdminOverviewStats(): Promise<AffiliateAdminOverviewStats | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data: accounts, error: accErr } = await db
    .from("affiliate_accounts")
    .select("status");
  if (accErr || !Array.isArray(accounts)) return null;

  let pendingApplications = 0;
  let needsContactApplications = 0;
  let activePartners = 0;
  let suspendedPartners = 0;
  for (const r of accounts as { status?: string }[]) {
    const s = typeof r.status === "string" ? r.status : "";
    if (s === "pending") pendingApplications += 1;
    else if (s === "needs_contact") needsContactApplications += 1;
    else if (s === "active") activePartners += 1;
    else if (s === "suspended") suspendedPartners += 1;
  }

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: commRows, error: commErr } = await db
    .from("affiliate_commissions")
    .select("commission_cents, status, created_at");
  let commissionsPendingCents = 0;
  let commissionsLast30dCents = 0;
  if (!commErr && Array.isArray(commRows)) {
    for (const r of commRows as { commission_cents?: unknown; status?: string; created_at?: string }[]) {
      const c = Math.floor(Number(r.commission_cents)) || 0;
      const st = typeof r.status === "string" ? r.status : "";
      if (st === "pending") commissionsPendingCents += c;
      const created = typeof r.created_at === "string" ? Date.parse(r.created_at) : NaN;
      if (Number.isFinite(created) && r.created_at && r.created_at >= since && st !== "voided") {
        commissionsLast30dCents += c;
      }
    }
  }

  let attributionRows = 0;
  const { count: attrCount, error: attrErr } = await db
    .from("affiliate_attributions")
    .select("*", { count: "exact", head: true });
  if (!attrErr && typeof attrCount === "number") attributionRows = attrCount;

  const openContactInquiries = await countOpenPublicContactInquiries();

  return {
    pendingApplications,
    needsContactApplications,
    activePartners,
    suspendedPartners,
    openContactInquiries,
    commissionsPendingCents,
    commissionsLast30dCents,
    attributionRows,
  };
}
