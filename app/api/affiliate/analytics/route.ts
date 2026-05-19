import { NextResponse } from "next/server";
import {
  getAffiliatePartnerAnalytics,
  parseAffiliateAnalyticsRange,
} from "@/lib/affiliate/affiliatePartnerAnalytics";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const rangeDays = parseAffiliateAnalyticsRange(url.searchParams.get("range"));

  const analytics = await getAffiliatePartnerAnalytics(auth.session.affiliateId, rangeDays);

  return NextResponse.json({ success: true, analytics });
}
