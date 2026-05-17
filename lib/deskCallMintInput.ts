import { normalizeDexscreenerMint } from "@/lib/dexscreenerMintMeta";

/** Parse pasted CA or Dexscreener Solana URL into a normalized mint. */
export function parseDeskCallMintInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const dex = trimmed.match(/dexscreener\.com\/solana\/([^/?#]+)/i);
  if (dex) {
    try {
      return normalizeDexscreenerMint(decodeURIComponent(dex[1]));
    } catch {
      return normalizeDexscreenerMint(dex[1]);
    }
  }

  return normalizeDexscreenerMint(trimmed);
}

export function isValidDeskCallMintInput(raw: string): boolean {
  return parseDeskCallMintInput(raw) != null;
}
