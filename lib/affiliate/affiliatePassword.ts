import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SALT_LEN = 16;
const KEY_LEN = 32;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashAffiliatePassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const key = scryptSync(password, salt, KEY_LEN);
  return `scrypt1.${salt.toString("base64url")}.${key.toString("base64url")}`;
}

export function verifyAffiliatePassword(password: string, stored: string): boolean {
  const parts = stored.split(".");
  if (parts.length !== 3 || parts[0] !== "scrypt1") return false;
  try {
    const salt = Buffer.from(parts[1]!, "base64url");
    const expected = Buffer.from(parts[2]!, "base64url");
    const actual = scryptSync(password, salt, KEY_LEN);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function isValidAffiliateEmail(email: string): boolean {
  const e = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
}

export { normalizeEmail as normalizeAffiliateEmail };
