import crypto from "crypto";
import type { NextResponse } from "next/server";

/** HttpOnly cookie: survives new Discord OAuth sessions; JWT trust fields are cleared on each OAuth sign-in. */
export const TOTP_DEVICE_TRUST_COOKIE = "mcg_totp_device";

function hmacSecret(): string | null {
  const s = process.env.NEXTAUTH_SECRET?.trim();
  return s || null;
}

function signPayload(discordId: string, expMs: number): string {
  const secret = hmacSecret();
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for TOTP device trust");
  const payload = `${discordId}|${expMs}`;
  const sig = crypto.createHmac("sha256", secret).update(`v1|${payload}`).digest("base64url");
  return `v1.${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

export function encodeTotpDeviceTrustCookieValue(discordId: string, expMs: number): string {
  const id = discordId.trim();
  if (!id) throw new Error("discordId required");
  return signPayload(id, Math.floor(expMs));
}

export function parseTotpDeviceTrustCookieValue(raw: string | undefined | null): {
  discordId: string;
  expMs: number;
} | null {
  if (!raw || typeof raw !== "string") return null;
  const secret = hmacSecret();
  if (!secret) return null;
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, b64Payload, sig] = parts;
  let payload: string;
  try {
    payload = Buffer.from(b64Payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const m = /^([1-9]\d{9,21})\|(\d+)$/.exec(payload);
  if (!m) return null;
  const discordId = m[1];
  const expMs = Number(m[2]);
  if (!Number.isFinite(expMs)) return null;
  const expected = crypto.createHmac("sha256", secret).update(`v1|${payload}`).digest("base64url");
  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(sig, "base64url");
    b = Buffer.from(expected, "base64url");
  } catch {
    return null;
  }
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { discordId, expMs };
}

export function totpDeviceTrustCookieMaxAgeSec(expMs: number): number {
  return Math.max(60, Math.floor((Math.floor(expMs) - Date.now()) / 1000));
}

export function applyTotpDeviceTrustCookie(res: NextResponse, discordId: string, trustExpiresAtMs: number): void {
  const exp = Math.floor(trustExpiresAtMs);
  const value = encodeTotpDeviceTrustCookieValue(discordId, exp);
  res.cookies.set(TOTP_DEVICE_TRUST_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: totpDeviceTrustCookieMaxAgeSec(exp),
  });
}

export function clearTotpDeviceTrustCookie(res: NextResponse): void {
  res.cookies.set(TOTP_DEVICE_TRUST_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
