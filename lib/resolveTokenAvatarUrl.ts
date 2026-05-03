/** Solana mint: base58, typical length 32–44. */
const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function dexScreenerSolTokenPngUrl(mint: string): string | null {
  const m = mint.trim();
  if (!m || !SOLANA_MINT_RE.test(m)) return null;
  return `https://dd.dexscreener.com/ds-data/tokens/solana/${m}.png`;
}

/**
 * Prefer stored snapshot URL; when missing, use DexScreener CDN token art (same pattern as bot embeds).
 */
export function resolveTokenAvatarUrl(args: {
  tokenImageUrl?: string | null;
  mint?: string | null;
}): string | null {
  const u = typeof args.tokenImageUrl === "string" ? args.tokenImageUrl.trim() : "";
  if (u) return u;
  return dexScreenerSolTokenPngUrl(typeof args.mint === "string" ? args.mint : "");
}
