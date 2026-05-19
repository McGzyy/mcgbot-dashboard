import { NextResponse } from "next/server";
import { affiliateCookieOptions, serializeAffiliateCookie } from "@/lib/affiliate/affiliateCookie";
import {
  getAffiliateById,
  getAffiliateByReferralCode,
} from "@/lib/affiliate/affiliateDb";
import { getAffiliateCampaignByLinkCode } from "@/lib/affiliate/affiliateCampaigns";
import { normalizeReferralCode } from "@/lib/affiliate/affiliateReferralCode";
import { DISCORD_SERVER_INVITE_URL } from "@/lib/discordInvite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code: raw } = await ctx.params;
  const code = normalizeReferralCode(raw);

  const res = NextResponse.redirect(DISCORD_SERVER_INVITE_URL, 302);

  let account = await getAffiliateByReferralCode(code);
  let campaignId: string | null = null;

  const campaign = await getAffiliateCampaignByLinkCode(code);
  if (campaign) {
    campaignId = campaign.id;
    account = await getAffiliateById(campaign.affiliateId);
  }

  if (account?.status === "active" && account.id) {
    const opts = affiliateCookieOptions();
    const clickMs = Date.now();
    res.cookies.set(opts.name, serializeAffiliateCookie(account.id, clickMs), {
      httpOnly: opts.httpOnly,
      sameSite: opts.sameSite,
      secure: opts.secure,
      path: opts.path,
      maxAge: opts.maxAgeSec,
    });
    if (campaignId) {
      res.cookies.set("mcgbot.affiliate.campaign", campaignId, {
        httpOnly: true,
        sameSite: opts.sameSite,
        secure: opts.secure,
        path: "/",
        maxAge: opts.maxAgeSec,
      });
    }
  }

  return res;
}
