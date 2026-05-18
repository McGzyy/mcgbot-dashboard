import { NextResponse } from "next/server";
import { regenerateAffiliateRecoveryCodes } from "@/lib/affiliate/affiliateRecoveryCodes";
import { verifyAffiliateTotpOrRecovery } from "@/lib/affiliate/affiliateTotp";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const totpCode = typeof body?.totpCode === "string" ? body.totpCode : "";
  if (!totpCode.trim()) {
    return NextResponse.json({ success: false, error: "2FA code required." }, { status: 400 });
  }

  const totp = await verifyAffiliateTotpOrRecovery(auth.session.affiliateId, totpCode);
  if (!totp.ok) {
    return NextResponse.json({ success: false, error: totp.error }, { status: 400 });
  }

  const codes = await regenerateAffiliateRecoveryCodes(auth.session.affiliateId);
  if (!codes) {
    return NextResponse.json({ success: false, error: "Could not regenerate codes." }, { status: 500 });
  }

  return NextResponse.json({ success: true, recoveryCodes: codes });
}
