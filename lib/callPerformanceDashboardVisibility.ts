/**
 * PostgREST `.or(...)` fragment: rows that should appear on public dashboard surfaces.
 * Calls with `hidden_from_dashboard === true` are staff-hidden from the web UI.
 */
export const CALL_PERFORMANCE_VISIBLE_ON_DASHBOARD_OR =
  "hidden_from_dashboard.is.null,hidden_from_dashboard.eq.false";

/** Staff-excluded calls must not appear in public listings (chain with `.or(...)`). */
export const CALL_PERFORMANCE_NOT_EXCLUDED_FROM_STATS_OR =
  "excluded_from_stats.is.null,excluded_from_stats.eq.false";

/**
 * Single `.or(...)` argument: **not hidden** AND **not excluded from stats**.
 * Use this instead of chaining `.or(VISIBLE).or(NOT_EXCLUDED)` — PostgREST only keeps one
 * `or` query param, so the second chain overwrote the first and let junk / excluded rows through.
 *
 * @see https://supabase.com/docs/reference/javascript/filter — nested `and(...)` inside `or()`.
 */
export const CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR =
  "and(or(hidden_from_dashboard.is.null,hidden_from_dashboard.eq.false),or(excluded_from_stats.is.null,excluded_from_stats.eq.false))";

export function isCallPerformanceRowEligibleForStats(row: Record<string, unknown>): boolean {
  const ex = row.excluded_from_stats;
  if (ex === true || ex === 1 || String(ex).toLowerCase() === "true") return false;
  const hi = row.hidden_from_dashboard;
  if (hi === true || hi === 1 || String(hi).toLowerCase() === "true") return false;
  return true;
}
