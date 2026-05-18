import { NextResponse } from "next/server";
import { authenticateAffiliate } from "@/lib/affiliate/affiliateDb";
import { affiliateSessionAvailable, applyAffiliateSessionCookie } from "@/lib/affiliate/affiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!affiliateSessionAvailable()) {
    return NextResponse.json(
      { success: false, error: "Affiliate sessions are not configured." },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email.trim() || !password) {
    return NextResponse.json({ success: false, error: "Email and password required." }, { status: 400 });
  }

  const result = await authenticateAffiliate(email, password);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status ?? 401 }
    );
  }

  const res = NextResponse.json({
    success: true,
    account: result.account,
    needsTotpEnrollment: !result.account.totpEnabled,
    pendingTotpVerification: result.account.totpEnabled,
  });
  applyAffiliateSessionCookie(res, result.sessionToken);
  return res;
}
