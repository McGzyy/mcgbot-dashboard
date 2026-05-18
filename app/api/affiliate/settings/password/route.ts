import { NextResponse } from "next/server";
import { getAffiliateByEmail, updateAffiliatePassword } from "@/lib/affiliate/affiliateDb";
import { verifyAffiliatePassword } from "@/lib/affiliate/affiliatePassword";
import { verifyAffiliateTotpOrRecovery } from "@/lib/affiliate/affiliateTotp";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const totpCode = typeof body?.totpCode === "string" ? body.totpCode : "";

  if (!currentPassword || !newPassword || !totpCode.trim()) {
    return NextResponse.json(
      { success: false, error: "Current password, new password, and 2FA code required." },
      { status: 400 }
    );
  }

  const row = await getAffiliateByEmail(auth.session.email);
  if (!row || !verifyAffiliatePassword(currentPassword, row.passwordHash)) {
    return NextResponse.json({ success: false, error: "Current password is incorrect." }, { status: 400 });
  }

  const totp = await verifyAffiliateTotpOrRecovery(auth.session.affiliateId, totpCode);
  if (!totp.ok) {
    return NextResponse.json({ success: false, error: totp.error }, { status: 400 });
  }

  const updated = await updateAffiliatePassword(auth.session.affiliateId, newPassword);
  if (!updated.ok) {
    return NextResponse.json({ success: false, error: updated.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
