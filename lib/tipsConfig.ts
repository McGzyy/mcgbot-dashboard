/** Memo text must match `TopBar` / Solana Pay `createTransfer` and `validateTransfer`. */
export const TIP_MEMO = "Tip for McGBot";

/** Prefer tips-specific treasury; fall back to generic SOL treasury from env example. */
export function tipsTreasuryPubkeyFromEnv(): string | null {
  const a = process.env.SOLANA_TIPS_TREASURY_PUBKEY?.trim();
  const b = process.env.SOLANA_TREASURY_PUBKEY?.trim();
  return a || b || null;
}
