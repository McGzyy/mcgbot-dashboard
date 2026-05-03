import { solanaRpcUrlServer } from "@/lib/solanaEnv";

/** Server-side RPC for membership / invoice verification (same defaults as dashboard Solana). */
export function getSolanaRpcUrl(): string {
  return solanaRpcUrlServer();
}
