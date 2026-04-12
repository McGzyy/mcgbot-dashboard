'use strict';

/**
 * Format pool/token age given as minutes (caller supplies the same value as before).
 *
 * @param {unknown} minutes
 * @returns {string}
 */
function formatAgeMinutes(minutes) {
  if (minutes === null || minutes === undefined) return 'N/A';
  const n = Number(minutes);
  if (!Number.isFinite(n)) return 'N/A';
  if (n < 60) return `${Math.floor(n)}m`;
  if (n < 1440) return `${Math.floor(n / 60)}h`;
  return `${Math.floor(n / 1440)}d`;
}

module.exports = { formatAgeMinutes };
