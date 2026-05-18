import { NextResponse } from "next/server";

import { getAffiliateById, refreshAffiliateSessionToken } from "@/lib/affiliate/affiliateDb";
import {
  applyAffiliateSessionCookie,
  getAffiliateSessionFromCookies,
} from "@/lib/affiliate/affiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Re-issue JWT from database so status changes (e.g. admin approval) take effect in middleware. */
export async function POST() {
  const session = await getAffiliateSessionFromCookies();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const account = await getAffiliateById(session.affiliateId);
  if (!account) {
    return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
  }

  const token = await refreshAffiliateSessionToken(session.affiliateId);
  if (!token) {
    return NextResponse.json({ success: false, error: "Could not refresh session." }, { status: 503 });
  }

  const res = NextResponse.json({ success: true, status: account.status });
  applyAffiliateSessionCookie(res, token);
  return res;
}
