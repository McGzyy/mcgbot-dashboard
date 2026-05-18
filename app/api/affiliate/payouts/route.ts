import { NextResponse } from "next/server";
import {
  createAffiliatePayoutRequest,
  getAffiliatePayoutBalance,
  listAffiliatePayoutRequests,
} from "@/lib/affiliate/affiliatePayouts";
import { verifyAffiliateTotpOrRecovery } from "@/lib/affiliate/affiliateTotp";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const balance = await getAffiliatePayoutBalance(auth.session.affiliateId);
  const requests = await listAffiliatePayoutRequests(auth.session.affiliateId);

  return NextResponse.json({ success: true, balance, requests });
}

export async function POST(request: Request) {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const amountCents = Math.floor(Number(body?.amountCents));
  const partnerNote = typeof body?.partnerNote === "string" ? body.partnerNote : null;
  const totpCode = typeof body?.totpCode === "string" ? body.totpCode : "";

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ success: false, error: "Invalid amount." }, { status: 400 });
  }
  if (!totpCode.trim()) {
    return NextResponse.json({ success: false, error: "2FA code required." }, { status: 400 });
  }

  const totp = await verifyAffiliateTotpOrRecovery(auth.session.affiliateId, totpCode);
  if (!totp.ok) {
    return NextResponse.json({ success: false, error: totp.error }, { status: 400 });
  }

  const created = await createAffiliatePayoutRequest({
    affiliateId: auth.session.affiliateId,
    amountCents,
    partnerNote,
  });
  if (!created.ok) {
    return NextResponse.json({ success: false, error: created.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, request: created.request });
}
