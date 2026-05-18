import { NextResponse } from "next/server";
import {
  getAffiliateById,
  refreshAffiliateSessionToken,
  signPartnerAgreement,
} from "@/lib/affiliate/affiliateDb";
import {
  applyAffiliateSessionCookie,
  affiliateSessionFullyVerified,
} from "@/lib/affiliate/affiliateSession";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as { accepted?: boolean } | null;
  if (body?.accepted !== true) {
    return NextResponse.json({ success: false, error: "You must accept the agreement." }, { status: 400 });
  }

  const ok = await signPartnerAgreement(auth.session.affiliateId);
  if (!ok) {
    return NextResponse.json({ success: false, error: "Could not record signature." }, { status: 500 });
  }

  const account = await getAffiliateById(auth.session.affiliateId);
  if (!account) {
    return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
  }

  const token = await refreshAffiliateSessionToken(auth.session.affiliateId);
  const res = NextResponse.json({ success: true, redirectTo: "/affiliate/dashboard" });
  if (token) applyAffiliateSessionCookie(res, token);
  return res;
}
