import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  generateRecoveryCodePlain,
  hashRecoveryCode,
  verifyRecoveryCode,
} from "@/lib/totpRecoveryCrypto";

const MAX_CODES = 10;

export async function regenerateAffiliateRecoveryCodes(affiliateId: string): Promise<string[] | null> {
  const id = affiliateId.trim();
  if (!id) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  await db.from("affiliate_recovery_codes").delete().eq("affiliate_id", id).is("used_at", null);
  const plains: string[] = [];
  const rows: { affiliate_id: string; code_hash: string }[] = [];
  for (let i = 0; i < MAX_CODES; i++) {
    const p = generateRecoveryCodePlain();
    plains.push(p);
    rows.push({ affiliate_id: id, code_hash: hashRecoveryCode(p) });
  }
  const { error } = await db.from("affiliate_recovery_codes").insert(rows);
  if (error) {
    console.error("[affiliateRecovery] insert", error);
    return null;
  }
  return plains;
}

export async function consumeAffiliateRecoveryCodeIfValid(
  affiliateId: string,
  plain: string
): Promise<boolean> {
  const id = affiliateId.trim();
  if (!id) return false;
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { data, error } = await db
    .from("affiliate_recovery_codes")
    .select("id, code_hash")
    .eq("affiliate_id", id)
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
      .from("affiliate_recovery_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", hid)
      .eq("affiliate_id", id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (!upErr && updated) return true;
    return false;
  }
  return false;
}

export async function countUnusedAffiliateRecoveryCodes(affiliateId: string): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return 0;
  const { count } = await db
    .from("affiliate_recovery_codes")
    .select("id", { count: "exact", head: true })
    .eq("affiliate_id", affiliateId.trim())
    .is("used_at", null);
  return typeof count === "number" ? count : 0;
}
