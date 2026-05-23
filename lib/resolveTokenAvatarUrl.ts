/** Solana mint: base58, typical length 32–44. */
const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function dexScreenerSolTokenPngUrl(mint: string): string | null {
  const m = mint.trim();
  if (!m || !SOLANA_MINT_RE.test(m)) return null;
  return `https://dd.dexscreener.com/ds-data/tokens/solana/${m}.png`;
}

/**
 * Discord / browser-safe https URL (ipfs:// and plain http often fail in <img>).
 */
export function normalizeTokenImageUrl(raw: string | null | undefined): string | null {
  const u = typeof raw === "string" ? raw.trim() : "";
  if (!u) return null;
  if (/^ipfs:\/\//i.test(u)) {
    const rest = u.slice(7).replace(/^ipfs\//i, "");
    return `https://cloudflare-ipfs.com/ipfs/${rest}`;
  }
  if (u.startsWith("http://")) {
    return `https://${u.slice("http://".length)}`;
  }
  if (!u.startsWith("https://")) return null;
  return u;
}

/**
 * Ordered candidates for <img> retry (deduped).
 */
export function tokenImageUrlCandidates(args: {
  tokenImageUrl?: string | null;
  mint?: string | null;
}): string[] {
  const out: string[] = [];
  const push = (u: string | null | undefined) => {
    const n = typeof u === "string" ? normalizeTokenImageUrl(u) : null;
    if (n && !out.includes(n)) out.push(n);
  };

  push(args.tokenImageUrl);
  const mint = typeof args.mint === "string" ? args.mint.trim() : "";
  if (mint) push(dexScreenerSolTokenPngUrl(mint));

  return out;
}

/**
 * Prefer stored snapshot URL (normalized); when missing, use DexScreener CDN token art.
 */
export function resolveTokenAvatarUrl(args: {
  tokenImageUrl?: string | null;
  mint?: string | null;
}): string | null {
  const candidates = tokenImageUrlCandidates(args);
  return candidates[0] ?? null;
}
