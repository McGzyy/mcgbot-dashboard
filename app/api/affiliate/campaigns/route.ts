import { NextResponse } from "next/server";
import {
  createAffiliateCampaign,
  ensureAffiliateCampaignLinkCode,
  listAffiliateCampaignsWithStats,
} from "@/lib/affiliate/affiliateCampaigns";
import { countAffiliateLinkClicks } from "@/lib/affiliate/affiliateLinkClicks";
import {
  affiliateShortCampaignUrl,
  affiliateShortReferralUrl,
} from "@/lib/affiliate/affiliateTrackingLink";
import { ensureAffiliateReferralCode, getAffiliateById } from "@/lib/affiliate/affiliateDb";
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

  const referralCode =
    account.referralCode ?? (await ensureAffiliateReferralCode(auth.session.affiliateId));
  if (!referralCode) {
    return NextResponse.json({ success: false, error: "Could not load referral link." }, { status: 500 });
  }

  const campaigns = await listAffiliateCampaignsWithStats(auth.session.affiliateId);
  const defaultClickCount = await countAffiliateLinkClicks(auth.session.affiliateId, {
    campaignId: null,
  });

  const campaignsWithUrls = await Promise.all(
    campaigns.map(async (c) => {
      const linkCode = c.linkCode ?? (await ensureAffiliateCampaignLinkCode(c.id));
      return {
        ...c,
        trackingUrl: linkCode ? affiliateShortCampaignUrl(linkCode) : null,
      };
    })
  );

  return NextResponse.json({
    success: true,
    defaultLink: affiliateShortReferralUrl(referralCode),
    referralCode,
    defaultClickCount,
    campaigns: campaignsWithUrls,
  });
}

export async function POST(request: Request) {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const name = typeof body?.name === "string" ? body.name : "";

  const created = await createAffiliateCampaign({
    affiliateId: auth.session.affiliateId,
    slug,
    name,
  });
  if (!created.ok) {
    return NextResponse.json({ success: false, error: created.error }, { status: 400 });
  }

  const linkCode = created.campaign.linkCode;
  const trackingUrl = linkCode ? affiliateShortCampaignUrl(linkCode) : null;

  return NextResponse.json({
    success: true,
    campaign: { ...created.campaign, clickCount: 0, trackingUrl },
  });
}
