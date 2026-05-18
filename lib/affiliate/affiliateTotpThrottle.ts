import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 12;

export async function assertAffiliateTotpVerifyAllowed(
  affiliateId: string
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const id = affiliateId.trim();
  if (!id) return { ok: false, retryAfterSec: 60 };
  const db = getSupabaseAdmin();
  if (!db) return { ok: true };

  const now = Date.now();
  const { data, error } = await db
    .from("affiliate_totp_verify_throttle")
    .select("attempts, window_started_at")
    .eq("affiliate_id", id)
    .maybeSingle();
  if (error || !data) return { ok: true };

  const attempts =
    typeof (data as { attempts?: unknown }).attempts === "number"
      ? Math.floor((data as { attempts: number }).attempts)
      : 0;
  const started =
    typeof (data as { window_started_at?: string }).window_started_at === "string"
      ? new Date((data as { window_started_at: string }).window_started_at).getTime()
      : now;
  if (now - started > WINDOW_MS) return { ok: true };
  if (attempts >= MAX_ATTEMPTS) {
    return { ok: false, retryAfterSec: Math.max(30, Math.ceil((WINDOW_MS - (now - started)) / 1000)) };
  }
  return { ok: true };
}

export async function recordAffiliateTotpVerifyFailure(affiliateId: string): Promise<void> {
  const id = affiliateId.trim();
  if (!id) return;
  const db = getSupabaseAdmin();
  if (!db) return;
  const now = new Date().toISOString();
  const { data } = await db
    .from("affiliate_totp_verify_throttle")
    .select("attempts, window_started_at")
    .eq("affiliate_id", id)
    .maybeSingle();
  const row = data as { attempts?: number; window_started_at?: string } | null;
  const attempts = typeof row?.attempts === "number" ? row.attempts : 0;
  const startedMs = row?.window_started_at ? new Date(row.window_started_at).getTime() : Date.now();
  if (!row || Date.now() - startedMs > WINDOW_MS) {
    await db.from("affiliate_totp_verify_throttle").upsert(
      { affiliate_id: id, attempts: 1, window_started_at: now },
      { onConflict: "affiliate_id" }
    );
    return;
  }
  await db
    .from("affiliate_totp_verify_throttle")
    .update({ attempts: attempts + 1 })
    .eq("affiliate_id", id);
}

export async function clearAffiliateTotpVerifyThrottle(affiliateId: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  await db.from("affiliate_totp_verify_throttle").delete().eq("affiliate_id", affiliateId.trim());
}
