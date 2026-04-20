import { filterRowsByMinCallTimeUtc } from "@/lib/callPerformanceLeaderboard";
import { getDashboardAdminSettings } from "@/lib/dashboardAdminSettingsDb";

let cache: { expires: number; cutoverMs: number | null } | null = null;
const TTL_MS = 15_000;

export function invalidateStatsCutoverCache(): void {
  cache = null;
}

/**
 * Inclusive UTC floor for `call_performance.call_time` in stats APIs.
 * Cached briefly so leaderboard requests do not hammer Supabase.
 */
export async function getStatsCutoverUtcMs(): Promise<number | null> {
  const now = Date.now();
  if (cache && cache.expires > now) {
    return cache.cutoverMs;
  }
  let cutoverMs: number | null = null;
  const row = await getDashboardAdminSettings();
  if (row?.stats_cutover_at) {
    const t = Date.parse(row.stats_cutover_at);
    cutoverMs = Number.isFinite(t) ? t : null;
  }
  cache = { expires: now + TTL_MS, cutoverMs };
  return cutoverMs;
}

/** Use max(rolling window start, stats cutover) so period windows stay correct. */
export function mergeStatsCutoverIntoMin(
  periodMinCallTimeMs: number,
  cutoverUtcMs: number | null
): number {
  if (cutoverUtcMs == null) return periodMinCallTimeMs;
  return Math.max(periodMinCallTimeMs, cutoverUtcMs);
}

/** Drop rows strictly before the cutover; no-op when cutover is unset. */
export function filterCallRowsForStats(
  rows: Record<string, unknown>[],
  cutoverUtcMs: number | null
): Record<string, unknown>[] {
  const keepExcluded = rows.filter((r) => (r as any).excluded_from_stats !== true);
  if (cutoverUtcMs == null) return keepExcluded;
  return filterRowsByMinCallTimeUtc(keepExcluded, cutoverUtcMs);
}
