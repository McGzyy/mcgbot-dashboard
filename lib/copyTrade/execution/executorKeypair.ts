import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

/**
 * Loads the copy-trade executor hot wallet from env (server only).
 * Prefer `COPY_TRADE_EXECUTOR_SOL_SECRET_BASE58` (Phantom-style export).
 * Fallback: `COPY_TRADE_EXECUTOR_SOL_SECRET_JSON` as `[byte,...]` JSON array.
 */
export function loadCopyTradeExecutorKeypair(): Keypair | null {
  const b58 = process.env.COPY_TRADE_EXECUTOR_SOL_SECRET_BASE58?.trim();
  if (b58) {
    try {
      const secret = bs58.decode(b58);
      if (secret.length === 64) return Keypair.fromSecretKey(secret);
      console.error("[copyTrade] executor base58 secret decoded to wrong length:", secret.length);
      return null;
    } catch (e) {
      console.error("[copyTrade] executor base58 decode failed:", e);
      return null;
    }
  }

  const jsonRaw = process.env.COPY_TRADE_EXECUTOR_SOL_SECRET_JSON?.trim();
  if (jsonRaw) {
    try {
      const arr = JSON.parse(jsonRaw) as unknown;
      if (!Array.isArray(arr) || arr.length !== 64) {
        console.error("[copyTrade] executor JSON secret must be a 64-element byte array.");
        return null;
      }
      const u8 = new Uint8Array(arr.map((n) => Number(n) & 0xff));
      return Keypair.fromSecretKey(u8);
    } catch (e) {
      console.error("[copyTrade] executor JSON secret parse failed:", e);
      return null;
    }
  }

  return null;
}
