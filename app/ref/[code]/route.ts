import { NextResponse } from "next/server";

import { DISCORD_SERVER_INVITE_URL } from "@/lib/discordInvite";
import { referralCookieOptions, serializeReferrerCookie } from "@/lib/referralCookie";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidDiscordSnowflake } from "@/lib/subscription/exemptAllowlistDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveReferrerDiscordId(code: string): Promise<string | null> {
  const raw = code.trim();
  if (!raw || raw.length > 64) return null;
  if (isValidDiscordSnowflake(raw)) return raw;

  const db = getSupabaseAdmin();
  if (!db) return null;
  const slug = raw.toLowerCase();
  const { data, error } = await db
    .from("users")
    .select("discord_id")
    .eq("referral_slug", slug)
    .maybeSingle();
  if (error || !data || typeof data !== "object") return null;
  const id = typeof (data as { discord_id?: string }).discord_id === "string"
    ? (data as { discord_id: string }).discord_id.trim()
    : "";
  return isValidDiscordSnowflake(id) ? id : null;
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code } = await ctx.params;
  const ownerId = await resolveReferrerDiscordId(code);
  const dest = DISCORD_SERVER_INVITE_URL;
  const res = NextResponse.redirect(dest, 302);
  if (ownerId) {
    const opts = referralCookieOptions();
    const clickMs = Date.now();
    res.cookies.set(opts.name, serializeReferrerCookie(ownerId, clickMs), {
      httpOnly: opts.httpOnly,
      sameSite: opts.sameSite,
      secure: opts.secure,
      path: opts.path,
      maxAge: opts.maxAgeSec,
    });
  }
  return res;
}
