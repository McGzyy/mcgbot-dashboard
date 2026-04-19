/** Loose Solana mint / contract validation (base58 length). */
export function isLikelySolanaMint(input: string): boolean {
  const clean = String(input || "").trim();
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean);
}
