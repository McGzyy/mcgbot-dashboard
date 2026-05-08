/**
 * Dashboard build shim.
 *
 * The main bot runtime has a richer `utils/callPerformanceSync.js` at the repo root,
 * but Next/Turbopack cannot follow server-relative imports outside this app.
 *
 * Dashboard code only needs this as an optional best-effort hook.
 */

function queueUpdateUserCallPerformanceAth(_contractAddress) {
  // no-op in dashboard build/runtime
}

module.exports = { queueUpdateUserCallPerformanceAth };

