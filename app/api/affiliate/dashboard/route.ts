import { NextResponse } from "next/server";
import { ensureAffiliateReferralCode, getAffiliateById } from "@/lib/affiliate/affiliateDb";
import { getAffiliateMilestoneProgress } from "@/lib/affiliate/affiliateMilestones";
import { affiliateShortReferralUrl } from "@/lib/affiliate/affiliateTrackingLink";
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
    revshareCents: 0,
    bonusCents: 0,
  };

  if (db) {
    const { data, error } = await db
      .from("affiliate_commissions")
      .select("commission_cents, status, kind")
      .eq("affiliate_id", auth.session.affiliateId);
    if (!error && Array.isArray(data)) {
      for (const r of data as { commission_cents?: unknown; status?: string; kind?: string }[]) {
        const c = Math.floor(Number(r.commission_cents)) || 0;
        if (c <= 0) continue;
        commissionSummary.rowCount += 1;
        const st = typeof r.status === "string" ? r.status : "";
        const kind = typeof r.kind === "string" ? r.kind : "revshare";
        if (st === "pending") commissionSummary.pendingCents += c;
        else if (st === "approved") commissionSummary.approvedCents += c;
        else if (st === "paid") commissionSummary.paidCents += c;
        if (kind === "revshare") commissionSummary.revshareCents += c;
        else commissionSummary.bonusCents += c;
      }
    }
  }

  const referralCode =
    account.status === "active"
      ? account.referralCode ?? (await ensureAffiliateReferralCode(account.id))
      : null;
  const trackingLink = referralCode ? affiliateShortReferralUrl(referralCode) : null;

  const milestones = await getAffiliateMilestoneProgress(auth.session.affiliateId);

  let referralCount = 0;
  if (db) {
    const { count } = await db
      .from("affiliate_attributions")
      .select("*", { count: "exact", head: true })
      .eq("affiliate_id", auth.session.affiliateId);
    referralCount = count ?? 0;
  }

  return NextResponse.json({
    success: true,
    account,
    commissionSummary,
    trackingLink,
    milestones,
    referralCount,
    program: {
      revShareSchedule: {
        monthly: [
          { payments: "1-12", ratePercent: 20 },
          { payments: "13-36", ratePercent: 10 },
        ],
        annual: [
          { payments: "1", ratePercent: 20 },
          { payments: "2-3", ratePercent: 10 },
        ],
        holdDays: { monthly: 30, annual: 90 },
      },
      annualSignupBonus: { basicCents: 500, proCents: 1000 },
      milestoneTiers: [
        {
          tier: 10,
          bonusCents: 6000,
          autoApprove: true,
          rule: "First payment + 7 days, still subscribed",
        },
        {
          tier: 25,
          bonusCents: 15000,
          autoApprove: false,
          rule: "Second payment cleared, still subscribed",
        },
        {
          tier: 50,
          bonusCents: 30000,
          autoApprove: false,
          rule: "Second payment cleared, still subscribed",
        },
      ],
    },
  });
}
