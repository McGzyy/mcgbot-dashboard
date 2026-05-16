/** Loose Solana contract address (CA) validation — base58, typical 32–44 chars. */
export function isLikelySolanaContractAddress(input: string): boolean {
  const clean = sanitizeContractAddressInput(String(input || ""));
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean);
}

/** @deprecated Use {@link isLikelySolanaContractAddress}. */
export const isLikelySolanaMint = isLikelySolanaContractAddress;

/** Strip BOM / zero-width chars users often paste from Discord or X. */
export function sanitizeContractAddressInput(raw: string): string {
  return String(raw || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

/**
 * Extract a Solana contract address (CA) from pasted text — raw CA, `solana:…`, Dexscreener/Solscan URLs, etc.
 */
export function parseSolanaContractAddressFromInput(raw: unknown): string | null {
  if (raw == null) return null;
  let s = sanitizeContractAddressInput(String(raw));
  if (!s) return null;

  if (/^solana:/i.test(s)) {
    s = s.replace(/^solana:/i, "").trim();
  }

  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      const pathParts = u.pathname.split("/").filter(Boolean);
      for (const part of pathParts) {
        if (isLikelySolanaContractAddress(part)) return part;
      }
      const qMint =
        u.searchParams.get("mint") ??
        u.searchParams.get("address") ??
        u.searchParams.get("ca");
      if (qMint && isLikelySolanaContractAddress(qMint.trim())) return qMint.trim();
    }
  } catch {
    /* not a URL */
  }

  if (s.length > 44) {
    const match = s.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    if (match?.[0] && isLikelySolanaContractAddress(match[0])) return match[0];
  }

  return isLikelySolanaContractAddress(s) ? s : null;
}

/** @deprecated Use {@link parseSolanaContractAddressFromInput}. */
export const parseSolanaMintFromInput = parseSolanaContractAddressFromInput;
