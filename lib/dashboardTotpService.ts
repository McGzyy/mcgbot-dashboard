import { authenticator } from "otplib";

/** ±2 steps (~±60s) — reduces false rejects from device clock drift. */
authenticator.options = { window: 2 };

export const DASHBOARD_TOTP_ISSUER = "McGBot Terminal";

export function verifyTotpCode(secretPlain: string, code: string): boolean {
  const c = code.replace(/\s/g, "").trim();
  if (!/^\d{6}$/.test(c)) return false;
  try {
    return authenticator.verify({ token: c, secret: secretPlain });
  } catch {
    return false;
  }
}

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function totpKeyUri(accountLabel: string, secretPlain: string): string {
  return authenticator.keyuri(accountLabel, DASHBOARD_TOTP_ISSUER, secretPlain);
}
