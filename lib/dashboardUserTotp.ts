import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptTotpSecret, isTotpCryptoConfigured } from "@/lib/totpCrypto";
import { verifyTotpOrRecoveryForSignIn } from "@/lib/totpRecoveryCodes";
import { looksLikeTotpInput } from "@/lib/totpRecoveryCrypto";

type UserTotpRow = {
  totp_enabled: boolean;
  totp_secret_enc: string | null;
};

async function fetchUserTotpRow(discordId: string): Promise<UserTotpRow | null> {
  const id = discordId.trim();
  if (!id) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("users")
    .select("totp_enabled, totp_secret_enc")
    .eq("discord_id", id)
    .maybeSingle();
  if (error || !data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  return {
    totp_enabled: o.totp_enabled === true,
    totp_secret_enc: typeof o.totp_secret_enc === "string" ? o.totp_secret_enc : null,
  };
}

/** McGBot Terminal user 2FA (same authenticator as member dashboard sign-in). */
export async function verifyDashboardUserTotpOrRecovery(
  discordId: string,
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isTotpCryptoConfigured()) {
    return { ok: false, error: "2FA is not configured on this server." };
  }
  const row = await fetchUserTotpRow(discordId);
  if (!row?.totp_enabled || !row.totp_secret_enc) {
    return {
      ok: false,
      error:
        "Enable 2FA on your McGBot Terminal account first (main dashboard → Settings → Security). Partner-portal 2FA (McGBot Affiliates) does not unlock the ops console.",
    };
  }
  try {
    decryptTotpSecret(row.totp_secret_enc);
  } catch {
    return { ok: false, error: "Could not read authenticator secret. Contact support." };
  }

  const v = await verifyTotpOrRecoveryForSignIn(discordId, code);
  if (v.ok) return { ok: true };

  const trimmed = code.trim();
  if (looksLikeTotpInput(trimmed.replace(/\s/g, ""))) {
    return {
      ok: false,
      error:
        "Invalid code. Use the McGBot Terminal entry in your authenticator app (not McGBot Affiliates), and confirm your phone clock is set automatically.",
    };
  }
  return { ok: false, error: v.error };
}
