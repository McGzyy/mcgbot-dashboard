import { NextResponse } from "next/server";
import { getAffiliateById } from "@/lib/affiliate/affiliateDb";
import { affiliateTrackingUrl } from "@/lib/affiliate/affiliateTrackingLink";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const account = await getAffiliateById(auth.session.affiliateId);
  if (!account) {
    return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
  }

  const db = getSupabaseAdmin();
  let commissionSummary = {
    pendingCents: 0,
    approvedCents: 0,
    paidCents: 0,
    rowCount: 0,
  };

  if (db) {
    const { data, error } = await db
      .from("affiliate_commissions")
      .select("commission_cents, status")
      .eq("affiliate_id", auth.session.affiliateId);
    if (!error && Array.isArray(data)) {
      for (const r of data as { commission_cents?: unknown; status?: string }[]) {
        const c = Math.floor(Number(r.commission_cents)) || 0;
        if (c <= 0) continue;
        commissionSummary.rowCount += 1;
        const st = typeof r.status === "string" ? r.status : "";
        if (st === "pending") commissionSummary.pendingCents += c;
        else if (st === "approved") commissionSummary.approvedCents += c;
        else if (st === "paid") commissionSummary.paidCents += c;
      }
    }
  }

  const trackingLink =
    account.status === "active" && account.affiliateSlug
      ? affiliateTrackingUrl(account.affiliateSlug)
      : null;

  return NextResponse.json({
    success: true,
    account,
    commissionSummary,
    trackingLink,
  });
}
