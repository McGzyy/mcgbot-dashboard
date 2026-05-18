import { cookies } from "next/headers";
import { decode, encode } from "next-auth/jwt";
import type { NextRequest, NextResponse } from "next/server";

export const AFFILIATE_OPS_SESSION_COOKIE = "mcgbot.affiliate.ops.session";

export type AffiliateOpsSessionClaims = {
  discordId: string;
};

function sessionSecret(): string | null {
  const s =
    process.env.AFFILIATE_OPS_SESSION_SECRET?.trim() ||
    process.env.AFFILIATE_SESSION_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "";
  return s || null;
}

export function affiliateOpsSessionAvailable(): boolean {
  return Boolean(sessionSecret());
}

export async function encodeAffiliateOpsSession(discordId: string): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const id = discordId.trim();
  if (!id) return null;
  return encode({
    token: {
      sub: id,
      discordId: id,
      kind: "affiliate_ops",
    },
    secret,
    maxAge: 12 * 60 * 60,
  });
}

export async function decodeAffiliateOpsSessionToken(
  token: string | undefined | null
): Promise<AffiliateOpsSessionClaims | null> {
  const secret = sessionSecret();
  if (!secret || !token?.trim()) return null;
  const decoded = await decode({ token: token.trim(), secret });
  if (!decoded || decoded.kind !== "affiliate_ops") return null;
  const discordId =
    typeof decoded.discordId === "string"
      ? decoded.discordId.trim()
      : typeof decoded.sub === "string"
        ? decoded.sub.trim()
        : "";
  if (!discordId) return null;
  return { discordId };
}

export async function getAffiliateOpsSessionFromCookies(): Promise<AffiliateOpsSessionClaims | null> {
  const jar = await cookies();
  const raw = jar.get(AFFILIATE_OPS_SESSION_COOKIE)?.value;
  return decodeAffiliateOpsSessionToken(raw);
}

export async function getAffiliateOpsSessionFromRequest(
  request: NextRequest
): Promise<AffiliateOpsSessionClaims | null> {
  const raw = request.cookies.get(AFFILIATE_OPS_SESSION_COOKIE)?.value;
  return decodeAffiliateOpsSessionToken(raw);
}

export function applyAffiliateOpsSessionCookie(res: NextResponse, token: string): void {
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(AFFILIATE_OPS_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 12 * 60 * 60,
  });
}

export function clearAffiliateOpsSessionCookie(res: NextResponse): void {
  res.cookies.set(AFFILIATE_OPS_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
