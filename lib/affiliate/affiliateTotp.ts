import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { encryptTotpSecret, decryptTotpSecret, isTotpCryptoConfigured } from "@/lib/totpCrypto";
import { generateTotpSecret, verifyTotpCode } from "@/lib/dashboardTotpService";
import { authenticator } from "otplib";

export const AFFILIATE_TOTP_ISSUER = "McGBot Affiliates";

function totpKeyUri(accountLabel: string, secretPlain: string): string {
  return authenticator.keyuri(accountLabel, AFFILIATE_TOTP_ISSUER, secretPlain);
}

export type AffiliateTotpRow = {
  totp_enabled: boolean;
  totp_secret_enc: string | null;
  totp_pending_enc: string | null;
};

export function affiliateTotpServiceAvailable(): boolean {
  return isTotpCryptoConfigured();
}

export async function fetchAffiliateTotpRow(affiliateId: string): Promise<AffiliateTotpRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("affiliate_accounts")
    .select("totp_enabled, totp_secret_enc, totp_pending_enc")
    .eq("id", affiliateId.trim())
    .maybeSingle();
  if (error || !data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  return {
    totp_enabled: o.totp_enabled === true,
    totp_secret_enc: typeof o.totp_secret_enc === "string" ? o.totp_secret_enc : null,
    totp_pending_enc: typeof o.totp_pending_enc === "string" ? o.totp_pending_enc : null,
  };
}

export async function startAffiliateTotpEnrollment(
  affiliateId: string,
  email: string
): Promise<{ secret: string; otpauthUrl: string } | null> {
  if (!affiliateTotpServiceAvailable()) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  const secret = generateTotpSecret();
  const pendingEnc = encryptTotpSecret(secret);
  const { error } = await db
    .from("affiliate_accounts")
    .update({ totp_pending_enc: pendingEnc })
    .eq("id", affiliateId.trim());
  if (error) {
    console.error("[affiliateTotp] enroll start", error);
    return null;
  }
  return { secret, otpauthUrl: totpKeyUri(email, secret) };
}

export async function finishAffiliateTotpEnrollment(
  affiliateId: string,
  code: string
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: string }> {
  if (!affiliateTotpServiceAvailable()) {
    return { ok: false, error: "Authenticator 2FA is not configured on this server." };
  }
  const row = await fetchAffiliateTotpRow(affiliateId);
  if (!row?.totp_pending_enc) {
    return { ok: false, error: "No enrollment in progress. Start setup again." };
  }
  let plain: string;
  try {
    plain = decryptTotpSecret(row.totp_pending_enc);
  } catch {
    return { ok: false, error: "Could not read pending secret. Start setup again." };
  }
  if (!verifyTotpCode(plain, code)) {
    return { ok: false, error: "Invalid code. Check the time on your device." };
  }
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not available." };
  const enc = encryptTotpSecret(plain);
  const { error } = await db
    .from("affiliate_accounts")
    .update({
      totp_secret_enc: enc,
      totp_pending_enc: null,
      totp_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", affiliateId.trim());
  if (error) {
    console.error("[affiliateTotp] enroll finish", error);
    return { ok: false, error: "Could not save TOTP settings." };
  }
  const { regenerateAffiliateRecoveryCodes } = await import("@/lib/affiliate/affiliateRecoveryCodes");
  const recoveryCodes = (await regenerateAffiliateRecoveryCodes(affiliateId)) ?? [];
  return { ok: true, recoveryCodes };
}

export async function verifyAffiliateTotpOrRecovery(
  affiliateId: string,
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await fetchAffiliateTotpRow(affiliateId);
  if (!row?.totp_enabled || !row.totp_secret_enc) {
    return { ok: false, error: "2FA is not enabled on this account." };
  }
  let plain: string;
  try {
    plain = decryptTotpSecret(row.totp_secret_enc);
  } catch {
    return { ok: false, error: "Could not read authenticator secret." };
  }
  if (verifyTotpCode(plain, code)) return { ok: true };
  const { consumeAffiliateRecoveryCodeIfValid } = await import("@/lib/affiliate/affiliateRecoveryCodes");
  const recoveryOk = await consumeAffiliateRecoveryCodeIfValid(affiliateId, code);
  if (recoveryOk) return { ok: true };
  return { ok: false, error: "Invalid authenticator or recovery code." };
}
