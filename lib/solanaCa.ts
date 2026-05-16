/** Loose Solana mint / contract validation (base58 length). */
export function isLikelySolanaMint(input: string): boolean {
  const clean = String(input || "").trim();
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean);
}

/**
 * Extract a Solana mint from pasted text (raw mint, `solana:…`, Dexscreener/Solscan URLs, etc.).
 */
export function parseSolanaMintFromInput(raw: unknown): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  if (/^solana:/i.test(s)) {
    s = s.replace(/^solana:/i, "").trim();
  }

  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      const pathParts = u.pathname.split("/").filter(Boolean);
      for (const part of pathParts) {
        if (isLikelySolanaMint(part)) return part;
      }
      const qMint = u.searchParams.get("mint") ?? u.searchParams.get("address");
      if (qMint && isLikelySolanaMint(qMint.trim())) return qMint.trim();
    }
  } catch {
    /* not a URL */
  }

  if (s.length > 44) {
    const match = s.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    if (match?.[0] && isLikelySolanaMint(match[0])) return match[0];
  }

  return isLikelySolanaMint(s) ? s : null;
}
