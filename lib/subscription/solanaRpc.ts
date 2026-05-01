/** Prefer private RPC on the server; public fallback for dev. */
export function getSolanaRpcUrl(): string {
  const fromEnv =
    (process.env.SOLANA_RPC_URL ?? "").trim() || (process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "").trim();
  if (fromEnv) return fromEnv;
  return "https://api.mainnet-beta.solana.com";
}
