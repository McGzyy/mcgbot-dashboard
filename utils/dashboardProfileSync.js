/**
 * Dashboard build shim.
 *
 * The main bot runtime has a richer `utils/dashboardProfileSync.js` at the repo root,
 * but Next/Turbopack cannot follow server-relative imports outside this app.
 *
 * Dashboard code calls this optionally when X verification state changes.
 */

function queueUserXRowSyncToSupabase(_discordUserId, _updates) {
  // no-op in dashboard build/runtime
}

module.exports = { queueUserXRowSyncToSupabase };

