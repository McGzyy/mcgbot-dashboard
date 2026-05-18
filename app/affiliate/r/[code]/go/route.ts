import { NextResponse } from "next/server";
import { affiliateCookieOptions, serializeAffiliateCookie } from "@/lib/affiliate/affiliateCookie";
import { getAffiliateBySlug } from "@/lib/affiliate/affiliateDb";
import { getAffiliateCampaignBySlug } from "@/lib/affiliate/affiliateCampaigns";
import { normalizeAffiliateSlug } from "@/lib/affiliate/affiliateSlug";
import { DISCORD_SERVER_INVITE_URL } from "@/lib/discordInvite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code } = await ctx.params;
  const url = new URL(request.url);
  const campaignRaw = url.searchParams.get("c");
  const account = await getAffiliateBySlug(code);

  const res = NextResponse.redirect(DISCORD_SERVER_INVITE_URL, 302);
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
    if (campaignRaw) {
      const campaign = await getAffiliateCampaignBySlug(
        account.id,
        normalizeAffiliateSlug(campaignRaw)
      );
      if (campaign) {
        res.cookies.set("mcgbot.affiliate.campaign", campaign.id, {
          httpOnly: true,
          sameSite: opts.sameSite,
          secure: opts.secure,
          path: "/",
          maxAge: opts.maxAgeSec,
        });
      }
    }
  }
  return res;
}
