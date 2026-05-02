/**
 * PostgREST `.or(...)` fragment: rows that should appear on public dashboard surfaces.
 * Calls with `hidden_from_dashboard === true` are staff-hidden from the web UI.
 */
export const CALL_PERFORMANCE_VISIBLE_ON_DASHBOARD_OR =
  "hidden_from_dashboard.is.null,hidden_from_dashboard.eq.false";
