import { NextResponse } from "next/server";
import { getAffiliateById } from "@/lib/affiliate/affiliateDb";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";
import { affiliateSessionFullyVerified } from "@/lib/affiliate/affiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAffiliateSession();
  if (!auth.ok) return auth.response;

  const account = await getAffiliateById(auth.session.affiliateId);
  if (!account) {
    return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    account,
    needsTotpEnrollment: auth.session.needsTotpEnrollment,
    pendingTotpVerification: auth.session.pendingTotpVerification,
    fullyVerified: affiliateSessionFullyVerified(auth.session),
  });
}
