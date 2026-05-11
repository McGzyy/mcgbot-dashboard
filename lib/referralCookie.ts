import {
  REFERRAL_ATTRIBUTION_CLICK_DAYS,
  REFERRAL_COOKIE_NAME,
} from "@/lib/referralPolicy";
import { isValidDiscordSnowflake } from "@/lib/subscription/exemptAllowlistDb";

export type ParsedReferrerCookie = { referrerDiscordId: string; clickMs: number };

export function serializeReferrerCookie(referrerDiscordId: string, clickMs: number): string {
  return `${referrerDiscordId.trim()}:${Math.floor(clickMs)}`;
}

export function parseReferrerCookie(raw: string | undefined | null): ParsedReferrerCookie | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  const idx = s.lastIndexOf(":");
  if (idx <= 0) return null;
  const referrerDiscordId = s.slice(0, idx).trim();
  const clickMs = Number(s.slice(idx + 1));
  if (!isValidDiscordSnowflake(referrerDiscordId)) return null;
  if (!Number.isFinite(clickMs) || clickMs <= 0) return null;
  return { referrerDiscordId, clickMs };
}

export function isReferrerClickFresh(clickMs: number, nowMs: number = Date.now()): boolean {
  const maxAge = REFERRAL_ATTRIBUTION_CLICK_DAYS * 86_400_000;
  return nowMs - clickMs <= maxAge;
}

export function referralCookieOptions(): {
  name: string;
  maxAgeSec: number;
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
} {
  return {
    name: REFERRAL_COOKIE_NAME,
    maxAgeSec: REFERRAL_ATTRIBUTION_CLICK_DAYS * 86_400,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
