import { NextResponse } from "next/server";
import { countUnusedAffiliateRecoveryCodes } from "@/lib/affiliate/affiliateRecoveryCodes";
import { affiliateTotpServiceAvailable, fetchAffiliateTotpRow } from "@/lib/affiliate/affiliateTotp";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAffiliateSession();
  if (!auth.ok) return auth.response;

  const row = await fetchAffiliateTotpRow(auth.session.affiliateId);
  const unusedRecoveryCount = row?.totp_enabled
    ? await countUnusedAffiliateRecoveryCodes(auth.session.affiliateId)
    : 0;

  return NextResponse.json({
    success: true,
    configured: affiliateTotpServiceAvailable(),
    enabled: row?.totp_enabled === true,
    enrollmentPending: Boolean(row?.totp_pending_enc),
    unusedRecoveryCount,
  });
}
