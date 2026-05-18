import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isDashboardAdminUser } from "@/lib/adminGate";
import {
  applyAffiliateOpsSessionCookie,
  encodeAffiliateOpsSession,
} from "@/lib/affiliate/affiliateOpsSession";
import {
  assertDashboardTotpVerifyAllowed,
  clearDashboardTotpVerifyThrottle,
  recordDashboardTotpVerifyFailure,
  verifyDashboardUserTotpOrRecovery,
} from "@/lib/dashboardUserTotp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId || !(await isDashboardAdminUser(session, discordId))) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const throttle = await assertDashboardTotpVerifyAllowed(discordId);
  if (!throttle.ok) {
    return NextResponse.json(
      { success: false, error: `Too many attempts. Try again in ${throttle.retryAfterSec} seconds.` },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = typeof body?.code === "string" ? body.code : "";
  const v = await verifyDashboardUserTotpOrRecovery(discordId, code);
  if (!v.ok) {
    await recordDashboardTotpVerifyFailure(discordId);
    return NextResponse.json({ success: false, error: v.error }, { status: 400 });
  }

  await clearDashboardTotpVerifyThrottle(discordId);

  const token = await encodeAffiliateOpsSession(discordId);
  if (!token) {
    return NextResponse.json({ success: false, error: "Session signing is not configured." }, { status: 503 });
  }

  const res = NextResponse.json({ success: true });
  applyAffiliateOpsSessionCookie(res, token);
  return res;
}
