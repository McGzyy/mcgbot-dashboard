import type { SupabaseClient } from "@supabase/supabase-js";

import { CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR } from "@/lib/callPerformanceDashboardVisibility";
import { filterCallRowsForStats, getStatsCutoverUtcMs, mergeStatsCutoverIntoMin } from "@/lib/statsCutover";

const CACHE_MS = 5 * 60_000;
const FETCH_LIMIT = 6000;

type CacheEntry = {
  at: number;
  rows: Record<string, unknown>[];
};

let cache: CacheEntry | null = null;

/** Shared desk rows for profile intel comparisons (short TTL, capped fetch). */
export async function loadDeskRowsForIntel(
  supabase: SupabaseClient,
  minCallTimeMs: number
): Promise<Record<string, unknown>[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return cache.rows;
  }

  const cutoverMs = await getStatsCutoverUtcMs();
  const fetchMin = mergeStatsCutoverIntoMin(minCallTimeMs, cutoverMs);

  const { data, error } = await supabase
    .from("call_performance")
    .select(
      "discord_id, username, ath_multiple, spot_multiple, call_time, source, excluded_from_stats"
    )
    .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR)
    .gte("call_time", fetchMin)
    .order("call_time", { ascending: false })
    .limit(FETCH_LIMIT);

  if (error) {
    console.warn("[deskAvgCache] load:", error.message);
    return cache?.rows ?? [];
  }

  const rows = filterCallRowsForStats(
    (Array.isArray(data) ? data : []) as Record<string, unknown>[],
    cutoverMs
  );
  cache = { at: now, rows };
  return rows;
}
