/** SPL USDC mints — mainnet canonical + devnet common test mint. */
export const SOLANA_USDC_MINT_MAINNET =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SOLANA_USDC_MINT_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPPECRbvQGQWVyAE";

export type SolanaClusterId = "mainnet-beta" | "devnet";

export function solanaClusterFromEnv(): SolanaClusterId {
  const c = process.env.NEXT_PUBLIC_SOLANA_CLUSTER?.trim().toLowerCase();
  return c === "devnet" ? "devnet" : "mainnet-beta";
}

/**
 * Mainnet default when no env URL is set. Solana's public `api.mainnet-beta.solana.com` often
 * returns 403 for app traffic (e.g. Solana Pay `createTransfer` reads); Ankr is a common fallback.
 */
const SOLANA_MAINNET_PUBLIC_RPC_FALLBACK = "https://rpc.ankr.com/solana";

/** Public RPC URL for browser + default server reads (override with NEXT_PUBLIC_SOLANA_RPC_URL / SOLANA_RPC_URL). */
export function solanaRpcUrlPublic(): string {
  const pub = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (pub) return pub;
  return solanaClusterFromEnv() === "devnet"
    ? "https://api.devnet.solana.com"
    : SOLANA_MAINNET_PUBLIC_RPC_FALLBACK;
}

/** Server-side balance / confirmation reads (prefer SOLANA_RPC_URL for secrets). */
export function solanaRpcUrlServer(): string {
  const s = process.env.SOLANA_RPC_URL?.trim();
  if (s) return s;
  return solanaRpcUrlPublic();
}

export function usdcMintForCluster(): string {
  return solanaClusterFromEnv() === "devnet"
    ? SOLANA_USDC_MINT_DEVNET
    : SOLANA_USDC_MINT_MAINNET;
}
