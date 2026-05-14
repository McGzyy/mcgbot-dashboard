import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { encryptTotpSecret, decryptTotpSecret, isTotpCryptoConfigured } from "@/lib/totpCrypto";
import { generateTotpSecret, totpKeyUri, verifyTotpCode } from "@/lib/dashboardTotpService";

export type TotpUserRow = {
  totp_enabled: boolean;
  totp_secret_enc: string | null;
  totp_pending_enc: string | null;
};

export async function fetchTotpRow(discordId: string): Promise<TotpUserRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("users")
    .select("totp_enabled, totp_secret_enc, totp_pending_enc")
    .eq("discord_id", discordId.trim())
    .maybeSingle();
  if (error || !data) return null;
  const o = data as Record<string, unknown>;
  return {
    totp_enabled: o.totp_enabled === true,
    totp_secret_enc: typeof o.totp_secret_enc === "string" ? o.totp_secret_enc : null,
    totp_pending_enc: typeof o.totp_pending_enc === "string" ? o.totp_pending_enc : null,
  };
}

export function totpServiceAvailable(): boolean {
  return isTotpCryptoConfigured();
}

export async function startTotpEnrollment(discordId: string): Promise<{ secret: string; otpauthUrl: string } | null> {
  if (!totpServiceAvailable()) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  const secret = generateTotpSecret();
  const pendingEnc = encryptTotpSecret(secret);
  const { data, error } = await db
    .from("users")
    .update({ totp_pending_enc: pendingEnc })
    .eq("discord_id", discordId.trim())
    .select("discord_id")
    .maybeSingle();
  if (error || !data) {
    console.error("[totp] start enrollment", error);
    return null;
  }
  return { secret, otpauthUrl: totpKeyUri(discordId, secret) };
}

export async function finishTotpEnrollment(
  discordId: string,
  code: string
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: string }> {
  if (!totpServiceAvailable()) return { ok: false, error: "TOTP is not configured on this server." };
  const row = await fetchTotpRow(discordId);
  if (!row?.totp_pending_enc) return { ok: false, error: "No enrollment in progress. Start setup again." };
  let plain: string;
  try {
    plain = decryptTotpSecret(row.totp_pending_enc);
  } catch {
    return { ok: false, error: "Could not read pending secret. Start setup again." };
  }
  if (!verifyTotpCode(plain, code)) return { ok: false, error: "Invalid code. Check the time on your device." };
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not available." };
  const enc = encryptTotpSecret(plain);
  const { error } = await db
    .from("users")
    .update({
      totp_secret_enc: enc,
      totp_pending_enc: null,
      totp_enabled: true,
    })
    .eq("discord_id", discordId.trim());
  if (error) {
    console.error("[totp] finish enrollment", error);
    return { ok: false, error: "Could not save TOTP settings." };
  }
  let recoveryCodes: string[] = [];
  try {
    const { regenerateRecoveryCodes } = await import("@/lib/totpRecoveryCodes");
    const codes = await regenerateRecoveryCodes(discordId);
    if (Array.isArray(codes)) recoveryCodes = codes;
  } catch (e) {
    console.error("[totp] finish enrollment recovery codes", e);
  }
  return { ok: true, recoveryCodes };
}

export async function disableTotp(discordId: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await fetchTotpRow(discordId);
  if (!row?.totp_enabled || !row.totp_secret_enc) return { ok: false, error: "TOTP is not enabled." };
  let plain: string;
  try {
    plain = decryptTotpSecret(row.totp_secret_enc);
  } catch {
    return { ok: false, error: "Could not read secret. Contact support." };
  }
  let secondFactorOk = verifyTotpCode(plain, code);
  if (!secondFactorOk) {
    const { consumeRecoveryCodeIfValid } = await import("@/lib/totpRecoveryCodes");
    secondFactorOk = await consumeRecoveryCodeIfValid(discordId, code);
  }
  if (!secondFactorOk) return { ok: false, error: "Invalid authenticator or recovery code." };
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not available." };
  const { error } = await db
    .from("users")
    .update({
      totp_secret_enc: null,
      totp_pending_enc: null,
      totp_enabled: false,
    })
    .eq("discord_id", discordId.trim());
  if (error) {
    console.error("[totp] disable", error);
    return { ok: false, error: "Could not disable TOTP." };
  }
  const { deleteAllRecoveryCodes } = await import("@/lib/totpRecoveryCodes");
  await deleteAllRecoveryCodes(discordId);
  const { clearTotpVerifyThrottle } = await import("@/lib/totpVerifyThrottle");
  await clearTotpVerifyThrottle(discordId);
  return { ok: true };
}

export async function verifyActiveTotpForSignIn(
  discordId: string,
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await fetchTotpRow(discordId);
  if (!row?.totp_enabled || !row.totp_secret_enc) return { ok: false, error: "TOTP is not enabled for this account." };
  let plain: string;
  try {
    plain = decryptTotpSecret(row.totp_secret_enc);
  } catch {
    return { ok: false, error: "Could not read secret." };
  }
  if (!verifyTotpCode(plain, code)) return { ok: false, error: "Invalid code." };
  return { ok: true };
}
