import { NextResponse } from "next/server";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";
import { affiliateTotpServiceAvailable, startAffiliateTotpEnrollment } from "@/lib/affiliate/affiliateTotp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireAffiliateSession();
  if (!auth.ok) return auth.response;

  if (!affiliateTotpServiceAvailable()) {
    return NextResponse.json(
      { success: false, error: "Authenticator 2FA is not configured (TOTP_ENCRYPTION_KEY)." },
      { status: 503 }
    );
  }

  const started = await startAffiliateTotpEnrollment(auth.session.affiliateId, auth.session.email);
  if (!started) {
    return NextResponse.json({ success: false, error: "Could not start enrollment." }, { status: 500 });
  }

  return NextResponse.json({ success: true, secret: started.secret, otpauthUrl: started.otpauthUrl });
}
