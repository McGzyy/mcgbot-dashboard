import { PublicKey } from "@solana/web3.js";

/**
 * Where copy-trade sell fees (native SOL) are sent.
 * Optional override; otherwise tips/treasury env used elsewhere in the dashboard.
 */
export function resolveCopyTradeFeeRecipientPubkey(): PublicKey | null {
  const raw =
    process.env.COPY_TRADE_FEE_RECIPIENT_PUBKEY?.trim() ||
    process.env.SOLANA_TIPS_TREASURY_PUBKEY?.trim() ||
    process.env.SOLANA_TREASURY_PUBKEY?.trim() ||
    "";
  if (!raw) return null;
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}
