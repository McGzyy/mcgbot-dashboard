import { NextResponse } from "next/server";

import { affiliateCookieOptions, serializeAffiliateCookie } from "@/lib/affiliate/affiliateCookie";
import { getAffiliateBySlug } from "@/lib/affiliate/affiliateDb";
import { DISCORD_SERVER_INVITE_URL } from "@/lib/discordInvite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code } = await ctx.params;
  const account = await getAffiliateBySlug(code);
  const dest = DISCORD_SERVER_INVITE_URL;
  const res = NextResponse.redirect(dest, 302);
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
  }
  return res;
}
