import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateRecoveryCodePlain, hashRecoveryCode, verifyRecoveryCode, looksLikeRecoveryCodeInput, looksLikeTotpInput } from "@/lib/totpRecoveryCrypto";
import { verifyActiveTotpForSignIn } from "@/lib/dashboardTotpUser";

const MAX_CODES = 10;

export async function countUnusedRecoveryCodes(discordId: string): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return 0;
  const { count, error } = await db
    .from("totp_recovery_codes")
    .select("id", { count: "exact", head: true })
    .eq("discord_id", discordId.trim())
    .is("used_at", null);
  if (error) return 0;
  return typeof count === "number" ? count : 0;
}

/** Replaces any existing unused codes. Returns plaintext codes once (caller must show to user only). */
export async function regenerateRecoveryCodes(discordId: string): Promise<string[] | null> {
  const id = discordId.trim();
  if (!id) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  await db.from("totp_recovery_codes").delete().eq("discord_id", id).is("used_at", null);
  const plains: string[] = [];
  const rows: { discord_id: string; code_hash: string }[] = [];
  for (let i = 0; i < MAX_CODES; i++) {
    const p = generateRecoveryCodePlain();
    plains.push(p);
    rows.push({ discord_id: id, code_hash: hashRecoveryCode(p) });
  }
  const { error } = await db.from("totp_recovery_codes").insert(rows);
  if (error) {
    console.error("[totpRecovery] insert", error);
    return null;
  }
  return plains;
}

export async function deleteAllRecoveryCodes(discordId: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  await db.from("totp_recovery_codes").delete().eq("discord_id", discordId.trim());
}

/**
 * If `plain` matches an unused recovery code, marks it used and returns true.
 */
export async function consumeRecoveryCodeIfValid(discordId: string, plain: string): Promise<boolean> {
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
    const hid = typeof (row as { id?: unknown }).id === "string" ? (row as { id: string }).id : "";
    const hash = typeof (row as { code_hash?: unknown }).code_hash === "string" ? (row as { code_hash: string }).code_hash : "";
    if (!hid || !hash) continue;
    if (!verifyRecoveryCode(plain, hash)) continue;
    const { data: updated, error: upErr } = await db
      .from("totp_recovery_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", hid)
      .eq("discord_id", id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (!upErr && updated) return true;
    return false;
  }
  return false;
}

/**
 * Returns true if the code matches the account TOTP **or** burns a recovery code.
 */
export async function verifyTotpOrRecoveryForSignIn(
  discordId: string,
  rawCode: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = rawCode.trim();
  if (!trimmed) return { ok: false, error: "Enter a code." };

  if (looksLikeRecoveryCodeInput(trimmed)) {
    const ok = await consumeRecoveryCodeIfValid(discordId, trimmed);
    if (ok) return { ok: true };
    return { ok: false, error: "Invalid or already used recovery code." };
  }

  const totp = await verifyActiveTotpForSignIn(discordId, trimmed);
  if (totp.ok) return { ok: true };

  if (looksLikeTotpInput(trimmed)) {
    return { ok: false, error: totp.error };
  }

  const okRec = await consumeRecoveryCodeIfValid(discordId, trimmed);
  if (okRec) return { ok: true };

  return { ok: false, error: "Invalid code." };
}
