import { NextResponse } from "next/server";
import { getAffiliateById, requestAffiliateSlugChange } from "@/lib/affiliate/affiliateDb";
import { verifyAffiliateTotpOrRecovery } from "@/lib/affiliate/affiliateTotp";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const newSlug = typeof body?.newSlug === "string" ? body.newSlug : "";
  const totpCode = typeof body?.totpCode === "string" ? body.totpCode : "";

  if (!newSlug.trim() || !totpCode.trim()) {
    return NextResponse.json({ success: false, error: "New slug and 2FA code required." }, { status: 400 });
  }

  const totp = await verifyAffiliateTotpOrRecovery(auth.session.affiliateId, totpCode);
  if (!totp.ok) {
    return NextResponse.json({ success: false, error: totp.error }, { status: 400 });
  }

  const result = await requestAffiliateSlugChange(auth.session.affiliateId, newSlug);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  const account = await getAffiliateById(auth.session.affiliateId);
  return NextResponse.json({
    success: true,
    slugChangePending: account?.slugChangePending ?? null,
  });
}
