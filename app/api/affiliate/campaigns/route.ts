import { NextResponse } from "next/server";
import {
  createAffiliateCampaign,
  listAffiliateCampaignsWithStats,
} from "@/lib/affiliate/affiliateCampaigns";
import { countAffiliateLinkClicks } from "@/lib/affiliate/affiliateLinkClicks";
import { affiliateTrackingUrl } from "@/lib/affiliate/affiliateTrackingLink";
import { getAffiliateById } from "@/lib/affiliate/affiliateDb";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const account = await getAffiliateById(auth.session.affiliateId);
  const partnerSlug = account?.affiliateSlug;
  if (!account || !partnerSlug) {
    return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
  }

  const campaigns = await listAffiliateCampaignsWithStats(auth.session.affiliateId);
  const defaultClickCount = await countAffiliateLinkClicks(auth.session.affiliateId, {
    campaignId: null,
  });

  return NextResponse.json({
    success: true,
    defaultLink: affiliateTrackingUrl(partnerSlug),
    defaultClickCount,
    campaigns: campaigns.map((c) => ({
      ...c,
      trackingUrl: affiliateTrackingUrl(partnerSlug, c.slug),
    })),
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

  const account = await getAffiliateById(auth.session.affiliateId);
  const partnerSlug = account?.affiliateSlug;
  const trackingUrl = partnerSlug
    ? affiliateTrackingUrl(partnerSlug, created.campaign.slug)
    : null;

  return NextResponse.json({
    success: true,
    campaign: { ...created.campaign, clickCount: 0, trackingUrl },
  });
}
