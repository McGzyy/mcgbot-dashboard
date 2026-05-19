import { NextResponse } from "next/server";
import { updateAffiliatePayoutMethod } from "@/lib/affiliate/affiliateDb";
import {
  AFFILIATE_PAYOUT_METHODS,
  parseAffiliatePayoutMethod,
} from "@/lib/affiliate/affiliatePayoutMethod";
import { verifyAffiliateTotpOrRecovery } from "@/lib/affiliate/affiliateTotp";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const method = parseAffiliatePayoutMethod(body?.payoutMethod ?? body?.method);
  const destination = typeof body?.payoutDestination === "string" ? body.payoutDestination : typeof body?.destination === "string" ? body.destination : "";
  const totpCode = typeof body?.totpCode === "string" ? body.totpCode : "";

  if (!method) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid payout method. Use one of: ${AFFILIATE_PAYOUT_METHODS.join(", ")}.`,
      },
      { status: 400 }
    );
  }
  if (!totpCode.trim()) {
    return NextResponse.json({ success: false, error: "2FA code required." }, { status: 400 });
  }

  const totp = await verifyAffiliateTotpOrRecovery(auth.session.affiliateId, totpCode);
  if (!totp.ok) {
    return NextResponse.json({ success: false, error: totp.error }, { status: 400 });
  }

  const updated = await updateAffiliatePayoutMethod(auth.session.affiliateId, {
    method,
    destination,
  });
  if (!updated.ok) {
    return NextResponse.json({ success: false, error: updated.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
