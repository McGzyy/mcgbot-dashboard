'use strict';

const { EmbedBuilder } = require('discord.js');
const { loadScannerSettings } = require('./scannerSettingsService');

const MS_HOUR = 60 * 60 * 1000;

/** Channel names that use the premium (48h) visibility window. */
const PREMIUM_CHANNEL_NAMES = new Set(['premium-approvals']);

const finalizedMessageIds = new Set();

/**
 * @returns {number} ms — default 18h (between 12–24)
 */
function getCoinApprovalDeleteDelayMs() {
  try {
    const s = loadScannerSettings();
    const h = Number(s.approvalCoinMessageDeleteHours);
    if (Number.isFinite(h) && h >= 12 && h <= 24) {
      return Math.round(h * MS_HOUR);
    }
  } catch (_) {
    /* scanner settings not ready — use default */
  }
  return 18 * MS_HOUR;
}

/**
 * @param {import('discord.js').GuildTextBasedChannel | null | undefined} channel
 * @returns {'premium' | 'coin'}
 */
function resolveCoinDeletionKind(channel) {
  const name = channel?.name || '';
  if (PREMIUM_CHANNEL_NAMES.has(name)) return 'premium';
  return 'coin';
}

/**
 * @param {'coin' | 'premium' | 'x_verify'} kind
 */
function getDeleteDelayMs(kind) {
  if (kind === 'premium') return 48 * MS_HOUR;
  if (kind === 'x_verify') return 24 * MS_HOUR;
  return getCoinApprovalDeleteDelayMs();
}

/**
 * @param {import('discord.js').Message} message
 * @param {'coin' | 'premium' | 'x_verify'} kind
 */
function scheduleApprovalMessageDeletion(message, kind) {
  if (!message?.channel) return;

  const delayMs = getDeleteDelayMs(kind);
  const channelId = message.channel.id;
  const messageId = message.id;

  setTimeout(() => {
    finalizedMessageIds.delete(messageId);
    message.channel.messages
      .fetch(messageId)
      .then(m => m.delete().catch(err => swallowDiscordNotFound(err)))
      .catch(() => {});
  }, delayMs);
}

/**
 * @param {unknown} err
 */
function swallowDiscordNotFound(err) {
  const code = err && /** @type {{ code?: number }} */ (err).code;
  if (code === 10008) return;
  if (err && /** @type {{ message?: string }} */ (err).message) {
    console.error('[ApprovalLifecycle] Delete failed:', err.message);
  }
}

/**
 * @param {import('discord.js').Message} message
 * @param {EmbedBuilder} embed
 * @param {'coin' | 'premium' | 'x_verify'} kind
 */
async function applyCompactFinalViewToMessage(message, embed, kind) {
  const id = message?.id;
  if (!id) return;

  if (finalizedMessageIds.has(id)) return;
  finalizedMessageIds.add(id);

  try {
    await message.edit({ embeds: [embed], components: [] });
  } catch (err) {
    finalizedMessageIds.delete(id);
    const code = err && /** @type {{ code?: number }} */ (err).code;
    if (code === 10008 || code === 50001) return;
    console.error('[ApprovalLifecycle] Edit failed:', err.message || err);
    return;
  }

  scheduleApprovalMessageDeletion(message, kind);
}

/**
 * @param {import('discord.js').ButtonInteraction | import('discord.js').ModalSubmitInteraction} interaction
 * @param {EmbedBuilder} embed
 * @param {'coin' | 'premium' | 'x_verify'} kind
 */
async function finalizeWithCompactEmbed(interaction, embed, kind) {
  const msg = interaction.message;
  const id = msg?.id;
  if (!id) return;

  if (finalizedMessageIds.has(id)) return;
  finalizedMessageIds.add(id);

  try {
    if (interaction.deferred) {
      await msg.edit({ embeds: [embed], components: [] });
    } else {
      await interaction.update({ embeds: [embed], components: [] });
    }
  } catch (err) {
    finalizedMessageIds.delete(id);
    const code = err && /** @type {{ code?: number }} */ (err).code;
    if (code === 10008 || code === 10062 || code === 50001) return;
    console.error('[ApprovalLifecycle] Interaction finalize failed:', err.message || err);
    return;
  }

  scheduleApprovalMessageDeletion(msg, kind);
}

/**
 * @param {object} trackedCall
 * @returns {EmbedBuilder}
 */
function buildCompactCoinApprovalEmbed(trackedCall) {
  const status = String(trackedCall.approvalStatus || '').toLowerCase();
  const map = {
    approved: { label: 'Approved', color: 0x22c55e },
    denied: { label: 'Denied', color: 0xef4444 },
    excluded: { label: 'Excluded', color: 0x64748b },
    expired: { label: 'Expired', color: 0x94a3b8 }
  };
  const row = map[status] || { label: 'Resolved', color: 0x64748b };

  const title = `🧪 ${trackedCall.tokenName || 'Unknown Token'} ($${trackedCall.ticker || 'UNKNOWN'})`;

  let modLine = '—';
  if (trackedCall.moderatedById) {
    modLine = `<@${trackedCall.moderatedById}> (${trackedCall.moderatedByUsername || 'mod'})`;
  } else if (trackedCall.moderatedByUsername) {
    modLine = trackedCall.moderatedByUsername;
  } else if (status === 'expired') {
    modLine = '— (auto-expired)';
  }

  const ts = trackedCall.moderatedAt
    ? new Date(trackedCall.moderatedAt)
    : new Date();
  const unix = Math.floor(ts.getTime() / 1000);

  return new EmbedBuilder()
    .setColor(row.color)
    .setTitle(title)
    .setDescription(
      `**Result:** ${row.label}\n**Moderator:** ${modLine}\n**Timestamp:** <t:${unix}:F>`
    )
    .setTimestamp(ts);
}

/**
 * @param {{ resultLabel: string, moderatorUser: import('discord.js').User, handle: string }} p
 * @returns {EmbedBuilder}
 */
function buildCompactXVerifyEmbed({ resultLabel, moderatorUser, handle }) {
  const modLine = moderatorUser?.id
    ? `<@${moderatorUser.id}> (${moderatorUser.username})`
    : moderatorUser?.username || '—';
  const ts = new Date();
  const unix = Math.floor(ts.getTime() / 1000);
  const color = resultLabel === 'Approved' ? 0x22c55e : 0xef4444;

  return new EmbedBuilder()
    .setColor(color)
    .setTitle('🧪 X Verification')
    .setDescription(
      `**Handle:** @${handle}\n**Result:** ${resultLabel}\n**Moderator:** ${modLine}\n**Timestamp:** <t:${unix}:F>`
    )
    .setTimestamp(ts);
}

module.exports = {
  PREMIUM_CHANNEL_NAMES,
  resolveCoinDeletionKind,
  getCoinApprovalDeleteDelayMs,
  getDeleteDelayMs,
  buildCompactCoinApprovalEmbed,
  buildCompactXVerifyEmbed,
  applyCompactFinalViewToMessage,
  finalizeWithCompactEmbed
};
