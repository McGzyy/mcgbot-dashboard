import { authenticator } from "otplib";

authenticator.options = { window: 1 };

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
