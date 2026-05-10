import type { SupabaseClient } from "@supabase/supabase-js";

export const FIX_IT_TICKETS_MODULE_KV_KEY = "fix_it_tickets_module_enabled";

/** When unset or unreadable, treat module as enabled (matches product default). */
export async function readFixItTicketsModuleEnabled(db: SupabaseClient): Promise<boolean> {
  const { data, error } = await db
    .from("dashboard_kv")
    .select("value")
    .eq("key", FIX_IT_TICKETS_MODULE_KV_KEY)
    .maybeSingle();

  if (error) {
    console.warn("[dashboard_kv] read fix_it module:", error.message);
    return true;
  }
  const v = typeof data?.value === "string" ? data.value.trim().toLowerCase() : "";
  if (!v) return true;
  return v !== "false" && v !== "0" && v !== "off" && v !== "no";
}

export async function writeFixItTicketsModuleEnabled(db: SupabaseClient, enabled: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const value = enabled ? "true" : "false";
  const { error } = await db.from("dashboard_kv").upsert(
    { key: FIX_IT_TICKETS_MODULE_KV_KEY, value, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  if (error) {
    console.error("[dashboard_kv] write fix_it module:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
