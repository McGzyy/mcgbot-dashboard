'use strict';

/**
 * Resolve the Discord guild for an approval record (stored guild id, else channel lookup).
 * Used so cleanup / prune / refresh never use the wrong guild in multi-guild bots.
 *
 * @param {import('discord.js').Client} client
 * @param {{ approvalGuildId?: string | null, approvalChannelId?: string | null }} trackedCall
 * @returns {Promise<import('discord.js').Guild | null>}
 */
async function resolveGuildForTrackedApproval(client, trackedCall) {
  if (!client || !trackedCall) return null;

  const gid = trackedCall.approvalGuildId ? String(trackedCall.approvalGuildId) : '';
  if (gid) {
    const cached = client.guilds.cache.get(gid);
    if (cached) return cached;
    try {
      return await client.guilds.fetch(gid);
    } catch (_) {
      /* fall through to channel */
    }
  }

  const cid = trackedCall.approvalChannelId ? String(trackedCall.approvalChannelId) : '';
  if (!cid) return null;

  let ch = client.channels.cache.get(cid);
  if (!ch) {
    try {
      ch = await client.channels.fetch(cid);
    } catch (_) {
      return null;
    }
  }

  if (ch && 'guild' in ch && ch.guild) return ch.guild;
  return null;
}

module.exports = { resolveGuildForTrackedApproval };
