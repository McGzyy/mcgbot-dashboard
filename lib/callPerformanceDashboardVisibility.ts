/**
 * PostgREST `.or(...)` fragment: rows that should appear on public dashboard surfaces.
 * Calls with `hidden_from_dashboard === true` are staff-hidden from the web UI.
 */
export const CALL_PERFORMANCE_VISIBLE_ON_DASHBOARD_OR =
  "hidden_from_dashboard.is.null,hidden_from_dashboard.eq.false";

/** Staff-excluded calls must not appear in public listings (chain with `.or(...)`). */
export const CALL_PERFORMANCE_NOT_EXCLUDED_FROM_STATS_OR =
  "excluded_from_stats.is.null,excluded_from_stats.eq.false";
