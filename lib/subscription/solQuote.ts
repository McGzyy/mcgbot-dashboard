import { LAMPORTS_PER_SOL } from "@solana/web3.js";

/** Round down to whole 10_000 lamports (~0.00001 SOL) for cleaner amounts. */
const LAMPORT_STEP = BigInt(10_000);

export function usdToLamports(usd: number, solUsd: number): bigint {
  if (!Number.isFinite(usd) || !Number.isFinite(solUsd) || solUsd <= 0 || usd <= 0) {
    return BigInt(0);
  }
  const sol = usd / solUsd;
  const raw = BigInt(Math.floor(sol * Number(LAMPORTS_PER_SOL)));
  if (raw <= BigInt(0)) return BigInt(0);
  return (raw / LAMPORT_STEP) * LAMPORT_STEP;
}

export function lamportsToSolString(lamports: bigint): string {
  const n = Number(lamports) / Number(LAMPORTS_PER_SOL);
  return n.toFixed(Math.min(6, Math.max(4, (n < 0.01 ? 6 : 4))));
}
