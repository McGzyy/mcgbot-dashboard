import { NextResponse } from "next/server";
import { buildAffiliateSessionForAccount, getAffiliateById } from "@/lib/affiliate/affiliateDb";
import { finishAffiliateTotpEnrollment } from "@/lib/affiliate/affiliateTotp";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";
import { applyAffiliateSessionCookie } from "@/lib/affiliate/affiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAffiliateSession();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ success: false, error: "Missing code." }, { status: 400 });
  }

  const finished = await finishAffiliateTotpEnrollment(auth.session.affiliateId, code);
  if (!finished.ok) {
    return NextResponse.json({ success: false, error: finished.error }, { status: 400 });
  }

  const account = await getAffiliateById(auth.session.affiliateId);
  if (!account) {
    return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
  }

  const sessionToken = await buildAffiliateSessionForAccount(account);
  if (!sessionToken) {
    return NextResponse.json({ success: false, error: "Could not refresh session." }, { status: 500 });
  }

  const res = NextResponse.json({
    success: true,
    recoveryCodes: finished.recoveryCodes,
  });
  applyAffiliateSessionCookie(res, sessionToken);
  return res;
}
