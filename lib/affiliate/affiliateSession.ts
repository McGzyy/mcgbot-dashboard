import { cookies } from "next/headers";
import { decode, encode } from "next-auth/jwt";
import type { NextRequest, NextResponse } from "next/server";

export const AFFILIATE_SESSION_COOKIE = "mcgbot.affiliate.session";

export type AffiliateAccountStatus = "pending" | "active" | "suspended";

export type AffiliateSessionClaims = {
  affiliateId: string;
  email: string;
  status: AffiliateAccountStatus;
  pendingTotpVerification: boolean;
  needsTotpEnrollment: boolean;
  /** Active partner must sign current agreement before hub access. */
  needsAgreement: boolean;
};

function sessionSecret(): string | null {
  const s =
    process.env.AFFILIATE_SESSION_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "";
  return s || null;
}

export function affiliateSessionAvailable(): boolean {
  return Boolean(sessionSecret());
}

export async function encodeAffiliateSession(claims: AffiliateSessionClaims): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  return encode({
    token: {
      sub: claims.affiliateId,
      email: claims.email,
      status: claims.status,
      pendingTotpVerification: claims.pendingTotpVerification,
      needsTotpEnrollment: claims.needsTotpEnrollment,
      needsAgreement: claims.needsAgreement,
      kind: "affiliate",
    },
    secret,
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function decodeAffiliateSessionToken(
  token: string | undefined | null
): Promise<AffiliateSessionClaims | null> {
  const secret = sessionSecret();
  if (!secret || !token?.trim()) return null;
  const decoded = await decode({ token: token.trim(), secret });
  if (!decoded || decoded.kind !== "affiliate") return null;
  const affiliateId = typeof decoded.sub === "string" ? decoded.sub.trim() : "";
  const email = typeof decoded.email === "string" ? decoded.email.trim().toLowerCase() : "";
  const status = decoded.status;
  if (!affiliateId || !email) return null;
  if (status !== "pending" && status !== "active" && status !== "suspended") return null;
  return {
    affiliateId,
    email,
    status,
    pendingTotpVerification: decoded.pendingTotpVerification === true,
    needsTotpEnrollment: decoded.needsTotpEnrollment === true,
    needsAgreement: decoded.needsAgreement === true,
  };
}

export async function getAffiliateSessionFromCookies(): Promise<AffiliateSessionClaims | null> {
  const jar = await cookies();
  const raw = jar.get(AFFILIATE_SESSION_COOKIE)?.value;
  return decodeAffiliateSessionToken(raw);
}

export async function getAffiliateSessionFromRequest(request: NextRequest): Promise<AffiliateSessionClaims | null> {
  const raw = request.cookies.get(AFFILIATE_SESSION_COOKIE)?.value;
  return decodeAffiliateSessionToken(raw);
}

export function applyAffiliateSessionCookie(res: NextResponse, token: string): void {
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(AFFILIATE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function clearAffiliateSessionCookie(res: NextResponse): void {
  res.cookies.set(AFFILIATE_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function affiliateSessionFullyVerified(session: AffiliateSessionClaims): boolean {
  return !session.needsTotpEnrollment && !session.pendingTotpVerification;
}
