import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

const MAX_FIRE_KEY_LEN = 180;

function isMissingFiresTableError(err: PostgrestError | null): boolean {
  if (!err) return false;
  const msg = `${err.message ?? ""} ${err.details ?? ""}`.toLowerCase();
  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    msg.includes("dashboard_alert_fires") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

/**
 * Insert a fire row; returns true when this is the first time (user_id, fire_key) fired.
 * Returns false when duplicate or on error.
 */
export async function tryRecordAlertFire(
  db: SupabaseClient,
  input: { userId: string; ruleId?: string | null; fireKey: string }
): Promise<{ isNew: boolean; tableMissing: boolean }> {
  const userId = input.userId.trim();
  const fireKey = input.fireKey.trim().slice(0, MAX_FIRE_KEY_LEN);
  if (!userId || !fireKey) return { isNew: false, tableMissing: false };

  const { error } = await db.from("dashboard_alert_fires").insert({
    user_id: userId,
    rule_id: input.ruleId?.trim() || null,
    fire_key: fireKey,
  });

  if (!error) return { isNew: true, tableMissing: false };
  if (error.code === "23505") return { isNew: false, tableMissing: false };
  if (isMissingFiresTableError(error)) {
    console.warn("[dashboardAlertFires] table missing — run migration 20260523120000_dashboard_alert_fires");
    return { isNew: false, tableMissing: true };
  }
  console.error("[dashboardAlertFires] insert:", error);
  return { isNew: false, tableMissing: false };
}
