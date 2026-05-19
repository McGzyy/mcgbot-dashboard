import { NextResponse } from "next/server";
import {
  getAffiliateById,
  updateAffiliateDisplayName,
} from "@/lib/affiliate/affiliateDb";
import { countUnusedAffiliateRecoveryCodes } from "@/lib/affiliate/affiliateRecoveryCodes";
import { AFFILIATE_SLUG_CHANGE_COOLDOWN_DAYS } from "@/lib/affiliate/affiliateSlugPolicy";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const account = await getAffiliateById(auth.session.affiliateId);
  if (!account) {
    return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
  }

  const recoveryCodesRemaining = await countUnusedAffiliateRecoveryCodes(auth.session.affiliateId);
  const cooldownBase = account.slugChangedAt ?? account.createdAt;
  const cooldownEnds = new Date(cooldownBase);
  cooldownEnds.setUTCDate(cooldownEnds.getUTCDate() + AFFILIATE_SLUG_CHANGE_COOLDOWN_DAYS);

  return NextResponse.json({
    success: true,
    account: {
      email: account.email,
      displayName: account.displayName,
      affiliateSlug: account.affiliateSlug,
      slugChangePending: account.slugChangePending,
      slugChangedAt: account.slugChangedAt,
      agreementVersion: account.agreementVersion,
      agreementSignedAt: account.agreementSignedAt,
      payoutMethod: account.payoutMethod,
      payoutDestination: account.payoutDestination,
      payoutMethodUpdatedAt: account.payoutMethodUpdatedAt,
    },
    recoveryCodesRemaining,
    slugChangeCooldownDays: AFFILIATE_SLUG_CHANGE_COOLDOWN_DAYS,
    slugChangeAllowedAfter: cooldownEnds.toISOString(),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (body && Object.prototype.hasOwnProperty.call(body, "displayName")) {
    const displayName = typeof body.displayName === "string" ? body.displayName : null;
    if (displayName && displayName.trim().length > 80) {
      return NextResponse.json({ success: false, error: "Display name too long." }, { status: 400 });
    }
    const ok = await updateAffiliateDisplayName(auth.session.affiliateId, displayName);
    if (!ok) {
      return NextResponse.json({ success: false, error: "Could not update display name." }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Nothing to update." }, { status: 400 });
}
