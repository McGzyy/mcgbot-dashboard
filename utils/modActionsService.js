'use strict';

const path = require('path');
const { writeJson } = require('./jsonStore');
const withJsonFile = writeJson.withFileLock;

const MOD_ACTIONS_PATH = path.join(__dirname, '../data/modActions.json');

const VALID_TYPES = new Set([
  'coin',
  'x_verify',
  'premium',
  'dev',
  'coin_deny',
  'coin_exclude',
  'x_verify_deny'
]);

/**
 * Append a moderator action record (queued, atomic write via jsonStore).
 * Fire-and-forget: do not await from approval handlers; failures are logged only.
 * Each row includes dedupeKey so double-delivery of the same Discord interaction
 * does not create duplicate rows.
 * @param {{ moderatorId: string, actionType: string, timestamp?: string, dedupeKey: string }} entry
 */
function recordModAction(entry) {
  const actionType = String(entry.actionType || '');
  const dedupeKey = String(entry.dedupeKey || '');
  const moderatorId = String(entry.moderatorId || '');

  if (!VALID_TYPES.has(actionType) || !dedupeKey || !moderatorId) {
    console.error('[ModActions] Invalid recordModAction entry');
    return;
  }

  const row = {
    moderatorId,
    actionType,
    timestamp: entry.timestamp || new Date().toISOString(),
    dedupeKey
  };

  withJsonFile(MOD_ACTIONS_PATH, async ({ readParsed, writeParsed }) => {
    let root;
    try {
      root = await readParsed();
    } catch (e) {
      const code = e && /** @type {{ code?: string }} */ (e).code;
      if (code === 'ENOENT') {
        root = { actions: [] };
      } else {
        console.error('[ModActions] read/parse failed, skipping append:', e.message || e);
        return;
      }
    }

    const actions = Array.isArray(root?.actions) ? root.actions : [];
    const seen = new Set(actions.map(a => a && a.dedupeKey).filter(Boolean));
    if (seen.has(dedupeKey)) {
      return;
    }

    actions.push(row);
    await writeParsed({ actions });
  }).catch(err => {
    console.error('[ModActions] Failed to record:', err.message || err);
  });
}

module.exports = {
  recordModAction,
  MOD_ACTIONS_PATH
};
