import type { SupabaseClient } from "@supabase/supabase-js";

/** Counts monitors that still reserve a slot (removed handles free a slot). */
export async function countActiveOutsideXSources(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from("outside_x_sources")
    .select("id", { count: "exact", head: true })
    .in("status", ["active", "suspended"]);
  if (error) throw new Error(error.message);
  return typeof count === "number" ? count : 0;
}
