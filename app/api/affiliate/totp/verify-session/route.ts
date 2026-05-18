import { NextResponse } from "next/server";
import { getAffiliateById } from "@/lib/affiliate/affiliateDb";
import { verifyAffiliateTotpOrRecovery } from "@/lib/affiliate/affiliateTotp";
import {
  assertAffiliateTotpVerifyAllowed,
  clearAffiliateTotpVerifyThrottle,
  recordAffiliateTotpVerifyFailure,
} from "@/lib/affiliate/affiliateTotpThrottle";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";
import { applyAffiliateSessionCookie, encodeAffiliateSession } from "@/lib/affiliate/affiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAffiliateSession();
  if (!auth.ok) return auth.response;

  if (!auth.session.pendingTotpVerification) {
    return NextResponse.json(
      { success: false, error: "2FA verification is not required for this session." },
      { status: 400 }
    );
  }

  const throttle = await assertAffiliateTotpVerifyAllowed(auth.session.affiliateId);
  if (!throttle.ok) {
    return NextResponse.json(
      { success: false, error: `Too many attempts. Try again in ${throttle.retryAfterSec} seconds.` },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const code = typeof body?.code === "string" ? body.code : "";
  const v = await verifyAffiliateTotpOrRecovery(auth.session.affiliateId, code);
  if (!v.ok) {
    await recordAffiliateTotpVerifyFailure(auth.session.affiliateId);
    return NextResponse.json({ success: false, error: v.error }, { status: 400 });
  }

  await clearAffiliateTotpVerifyThrottle(auth.session.affiliateId);

  const account = await getAffiliateById(auth.session.affiliateId);
  if (!account) {
    return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
  }

  const sessionToken = await encodeAffiliateSession({
    affiliateId: account.id,
    email: account.email,
    status: account.status,
    needsTotpEnrollment: false,
    pendingTotpVerification: false,
  });
  if (!sessionToken) {
    return NextResponse.json({ success: false, error: "Could not refresh session." }, { status: 500 });
  }

  const res = NextResponse.json({ success: true });
  applyAffiliateSessionCookie(res, sessionToken);
  return res;
}
