'use strict';

let botFallbackThumbnailUrl = null;

/**
 * @param {string | null | undefined} url
 */
function setBotEmbedThumbnailFallbackUrl(url) {
  botFallbackThumbnailUrl =
    typeof url === 'string' && url.trim() ? url.trim() : null;
}

function getBotEmbedThumbnailFallbackUrl() {
  return botFallbackThumbnailUrl;
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function safeTrimmedUrl(v) {
  if (v == null) return '';
  if (typeof v === 'string') {
    const t = v.trim();
    return t;
  }
  const s = String(v).trim();
  return s || '';
}

/**
 * @param {...unknown} candidates
 * @returns {string}
 */
function pickNonEmptyUrl(...candidates) {
  for (const c of candidates) {
    const t = safeTrimmedUrl(c);
    if (t) return t;
  }
  return '';
}

/**
 * DexScreener image first, then GeckoTerminal token metadata, then bot avatar (if set).
 * @param {unknown} scan
 * @returns {string}
 */
function resolveScanThumbnailUrl(scan) {
  const token =
    scan && typeof scan === 'object' ? /** @type {{ token?: unknown }} */ (scan).token : undefined;
  const t =
    token && typeof token === 'object'
      ? /** @type {{ imageUrl?: unknown, geckoImageUrl?: unknown }} */ (token)
      : null;
  return pickNonEmptyUrl(
    t?.imageUrl,
    t?.geckoImageUrl,
    getBotEmbedThumbnailFallbackUrl()
  );
}

/**
 * @param {import('discord.js').EmbedBuilder} embed
 * @param {unknown} scan
 */
function applyScanThumbnailToEmbed(embed, scan) {
  if (!embed || typeof embed.setThumbnail !== 'function') return;
  const url = resolveScanThumbnailUrl(scan);
  if (!url) return;
  try {
    embed.setThumbnail(url);
  } catch (_) {
    /* invalid URL — omit thumbnail */
  }
}

module.exports = {
  setBotEmbedThumbnailFallbackUrl,
  getBotEmbedThumbnailFallbackUrl,
  resolveScanThumbnailUrl,
  applyScanThumbnailToEmbed
};
