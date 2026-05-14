import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

function recoveryPepper(): string {
  const k = process.env.TOTP_ENCRYPTION_KEY?.trim();
  return k ? `totp-recovery:${k.slice(0, Math.min(48, k.length))}` : "totp-recovery:no-pepper";
}

/** Deterministic hash for a one-time recovery code (never store plaintext). */
export function hashRecoveryCode(plain: string): string {
  const norm = plain.replace(/[\s-]/g, "").toUpperCase();
  const salt = randomBytes(16);
  const key = scryptSync(`${recoveryPepper()}:${norm}`, salt, 32);
  return `v1.${salt.toString("base64url")}.${key.toString("base64url")}`;
}

export function verifyRecoveryCode(plain: string, stored: string): boolean {
  const norm = plain.replace(/[\s-]/g, "").toUpperCase();
  const parts = stored.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  try {
    const salt = Buffer.from(parts[1]!, "base64url");
    const want = Buffer.from(parts[2]!, "base64url");
    const key = scryptSync(`${recoveryPepper()}:${norm}`, salt, 32);
    if (want.length !== key.length) return false;
    return timingSafeEqual(want, key);
  } catch {
    return false;
  }
}

/** 10 uppercase hex chars (5 random bytes), e.g. A3F9E2B1C8 */
export function generateRecoveryCodePlain(): string {
  return randomBytes(5).toString("hex").toUpperCase();
}

export function looksLikeRecoveryCodeInput(raw: string): boolean {
  const s = raw.replace(/[\s-]/g, "").toUpperCase();
  return /^[0-9A-F]{10}$/.test(s);
}

export function looksLikeTotpInput(raw: string): boolean {
  const s = raw.replace(/\s/g, "");
  return /^\d{6}$/.test(s);
}
