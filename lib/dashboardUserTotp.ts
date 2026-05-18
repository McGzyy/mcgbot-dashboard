import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTotpCode } from "@/lib/dashboardTotpService";
import { decryptTotpSecret, isTotpCryptoConfigured } from "@/lib/totpCrypto";
import { hashRecoveryCode, verifyRecoveryCode } from "@/lib/totpRecoveryCrypto";

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

async function consumeUserRecoveryCodeIfValid(discordId: string, plain: string): Promise<boolean> {
  const id = discordId.trim();
  if (!id) return false;
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { data, error } = await db
    .from("totp_recovery_codes")
    .select("id, code_hash")
    .eq("discord_id", id)
    .is("used_at", null);
  if (error || !Array.isArray(data)) return false;
  for (const row of data) {
    const hid = typeof (row as { id?: string }).id === "string" ? (row as { id: string }).id : "";
    const hash =
      typeof (row as { code_hash?: string }).code_hash === "string"
        ? (row as { code_hash: string }).code_hash
        : "";
    if (!hid || !hash || !verifyRecoveryCode(plain, hash)) continue;
    const { data: updated, error: upErr } = await db
      .from("totp_recovery_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", hid)
      .eq("discord_id", id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (!upErr && updated) return true;
  }
  return false;
}

export async function assertDashboardTotpVerifyAllowed(
  discordId: string
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const id = discordId.trim();
  if (!id) return { ok: false, retryAfterSec: 60 };
  const db = getSupabaseAdmin();
  if (!db) return { ok: true };

  const maxAttempts = 8;
  const windowMs = 15 * 60_000;
  const { data } = await db
    .from("totp_verify_throttle")
    .select("attempts, window_started_at")
    .eq("discord_id", id)
    .maybeSingle();

  const now = Date.now();
  if (!data) return { ok: true };

  const attempts = Math.floor(Number((data as { attempts?: unknown }).attempts)) || 0;
  const started = (data as { window_started_at?: string }).window_started_at;
  const startMs = typeof started === "string" ? Date.parse(started) : NaN;
  if (!Number.isFinite(startMs) || now - startMs > windowMs) return { ok: true };
  if (attempts < maxAttempts) return { ok: true };

  const retryAfterSec = Math.max(1, Math.ceil((startMs + windowMs - now) / 1000));
  return { ok: false, retryAfterSec };
}

export async function recordDashboardTotpVerifyFailure(discordId: string): Promise<void> {
  const id = discordId.trim();
  if (!id) return;
  const db = getSupabaseAdmin();
  if (!db) return;
  const now = new Date().toISOString();
  const { data } = await db
    .from("totp_verify_throttle")
    .select("attempts, window_started_at")
    .eq("discord_id", id)
    .maybeSingle();

  if (!data) {
    await db.from("totp_verify_throttle").upsert(
      { discord_id: id, attempts: 1, window_started_at: now },
      { onConflict: "discord_id" }
    );
    return;
  }

  const attempts = Math.floor(Number((data as { attempts?: unknown }).attempts)) || 0;
  const started = (data as { window_started_at?: string }).window_started_at;
  const startMs = typeof started === "string" ? Date.parse(started) : NaN;
  const windowExpired = !Number.isFinite(startMs) || Date.now() - startMs > 15 * 60_000;

  await db
    .from("totp_verify_throttle")
    .update({
      attempts: windowExpired ? 1 : attempts + 1,
      window_started_at: windowExpired ? now : started,
    })
    .eq("discord_id", id);
}

export async function clearDashboardTotpVerifyThrottle(discordId: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  await db.from("totp_verify_throttle").delete().eq("discord_id", discordId.trim());
}

/** McGBot Terminal user 2FA (same authenticator as member dashboard). */
export async function verifyDashboardUserTotpOrRecovery(
  discordId: string,
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isTotpCryptoConfigured()) {
    return { ok: false, error: "2FA is not configured on this server." };
  }
  const row = await fetchUserTotpRow(discordId);
  if (!row?.totp_enabled || !row.totp_secret_enc) {
    return { ok: false, error: "Enable 2FA on your McGBot account first (Terminal settings)." };
  }
  let plain: string;
  try {
    plain = decryptTotpSecret(row.totp_secret_enc);
  } catch {
    return { ok: false, error: "Could not read authenticator secret." };
  }
  if (verifyTotpCode(plain, code)) return { ok: true };
  if (await consumeUserRecoveryCodeIfValid(discordId, code)) return { ok: true };
  return { ok: false, error: "Invalid authenticator or recovery code." };
}
