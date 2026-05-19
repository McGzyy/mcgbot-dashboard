import { NextResponse } from "next/server";
import { getAffiliateById } from "@/lib/affiliate/affiliateDb";
import { affiliateDenialReapplyState } from "@/lib/affiliate/affiliateDenialReapply";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";
import { affiliateSessionFullyVerified } from "@/lib/affiliate/affiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAffiliateSession();
  if (!auth.ok) return auth.response;

  const account = await getAffiliateById(auth.session.affiliateId);
  if (!account) {
    return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
  }

  const reapply = affiliateDenialReapplyState(account);

  return NextResponse.json({
    success: true,
    account: {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      status: account.status,
      application: {
        legalName: account.application.legalName,
        companyName: account.application.companyName,
        country: account.application.country,
        primaryChannel: account.application.primaryChannel,
        audienceSize: account.application.audienceSize,
        promoMethods: account.application.promoMethods,
        socialLinks: account.application.socialLinks,
        websiteUrl: account.application.websiteUrl,
        notes: account.application.notes,
        submittedAt: account.application.submittedAt,
        denialReason: account.application.denialReason,
        denialReapplyAllowed: account.application.denialReapplyAllowed,
        reapplyAfter: account.application.reapplyAfter,
        canReapplyNow: reapply.canReapplyNow,
        reapplyBlockedMessage: reapply.blockedMessage,
        contactEmail: account.application.contactEmail,
        contactDiscord: account.application.contactDiscord,
        contactX: account.application.contactX,
        contactOther: account.application.contactOther,
      },
    },
    needsTotpEnrollment: auth.session.needsTotpEnrollment,
    pendingTotpVerification: auth.session.pendingTotpVerification,
    fullyVerified: affiliateSessionFullyVerified(auth.session),
  });
}
