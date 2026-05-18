import { NextResponse } from "next/server";
import { clearAffiliateSessionCookie } from "@/lib/affiliate/affiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ success: true });
  clearAffiliateSessionCookie(res);
  return res;
}
