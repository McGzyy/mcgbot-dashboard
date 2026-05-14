import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 12;

export async function assertTotpVerifyAllowed(discordId: string): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const id = discordId.trim();
  if (!id) return { ok: false, retryAfterSec: 60 };
  const db = getSupabaseAdmin();
  if (!db) return { ok: true };

  const now = Date.now();
  const { data, error } = await db.from("totp_verify_throttle").select("attempts, window_started_at").eq("discord_id", id).maybeSingle();
  if (error) return { ok: true };

  if (!data || typeof data !== "object") {
    return { ok: true };
  }
  const row = data as { attempts?: unknown; window_started_at?: unknown };
  const attempts = typeof row.attempts === "number" && Number.isFinite(row.attempts) ? Math.floor(row.attempts) : 0;
  const started =
    typeof row.window_started_at === "string" ? new Date(row.window_started_at).getTime() : now;
  if (!Number.isFinite(started)) return { ok: true };

  if (now - started > WINDOW_MS) {
    return { ok: true };
  }
  if (attempts >= MAX_ATTEMPTS) {
    const retryMs = WINDOW_MS - (now - started);
    return { ok: false, retryAfterSec: Math.max(30, Math.ceil(retryMs / 1000)) };
  }
  return { ok: true };
}

export async function recordTotpVerifyFailure(discordId: string): Promise<void> {
  const id = discordId.trim();
  if (!id) return;
  const db = getSupabaseAdmin();
  if (!db) return;
  const now = new Date().toISOString();
  const { data } = await db.from("totp_verify_throttle").select("attempts, window_started_at").eq("discord_id", id).maybeSingle();
  const row = data as { attempts?: unknown; window_started_at?: unknown } | null;
  const attempts = typeof row?.attempts === "number" && Number.isFinite(row.attempts) ? Math.floor(row.attempts) : 0;
  const startedMs =
    typeof row?.window_started_at === "string" ? new Date(row.window_started_at).getTime() : Date.now();
  if (!row || Date.now() - startedMs > WINDOW_MS) {
    await db.from("totp_verify_throttle").upsert(
      { discord_id: id, attempts: 1, window_started_at: now },
      { onConflict: "discord_id" }
    );
    return;
  }
  await db.from("totp_verify_throttle").update({ attempts: attempts + 1 }).eq("discord_id", id);
}

export async function clearTotpVerifyThrottle(discordId: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  await db.from("totp_verify_throttle").delete().eq("discord_id", discordId.trim());
}
