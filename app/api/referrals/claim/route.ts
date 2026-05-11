import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { referralCookieOptions, serializeReferrerCookie } from "@/lib/referralCookie";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidDiscordSnowflake } from "@/lib/subscription/exemptAllowlistDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveReferrerFromBody(body: Record<string, unknown>): Promise<string | null> {
  const idRaw = typeof body.referrerDiscordId === "string" ? body.referrerDiscordId.trim() : "";
  if (isValidDiscordSnowflake(idRaw)) return idRaw;

  const slug = typeof body.referralSlug === "string" ? body.referralSlug.trim().toLowerCase() : "";
  if (!slug || slug.length > 64) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data } = await db.from("users").select("discord_id").eq("referral_slug", slug).maybeSingle();
  if (!data || typeof data !== "object") return null;
  const id = typeof (data as { discord_id?: string }).discord_id === "string"
    ? (data as { discord_id: string }).discord_id.trim()
    : "";
  return isValidDiscordSnowflake(id) ? id : null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const selfId = session?.user?.id?.trim() ?? "";
  if (!selfId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const ownerId = await resolveReferrerFromBody(body);
  if (!ownerId) {
    return NextResponse.json({ error: "Unknown referrer" }, { status: 400 });
  }
  if (ownerId === selfId) {
    return NextResponse.json({ error: "Self-referral is not allowed" }, { status: 400 });
  }

  const opts = referralCookieOptions();
  const clickMs = Date.now();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(opts.name, serializeReferrerCookie(ownerId, clickMs), {
    httpOnly: opts.httpOnly,
    sameSite: opts.sameSite,
    secure: opts.secure,
    path: opts.path,
    maxAge: opts.maxAgeSec,
  });
  return res;
}
