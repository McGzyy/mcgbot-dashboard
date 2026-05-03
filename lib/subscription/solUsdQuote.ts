import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const COINGECKO =
  "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=false";

type CoingeckoSimple = {
  solana?: { usd?: number };
};

/** Fetches SOL/USD (same endpoint family as `/api/market`). */
export async function fetchSolUsdPrice(): Promise<number> {
  const res = await fetch(COINGECKO, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`CoinGecko HTTP ${res.status}`);
  }
  const data = (await res.json()) as CoingeckoSimple;
  const p = Number(data?.solana?.usd);
  if (!Number.isFinite(p) || p <= 0) {
    throw new Error("Invalid SOL price from CoinGecko");
  }
  return p;
}

/** Convert a USD fiat anchor to lamports, rounding up so we never under-collect vs the USD quote. */
export function usdToLamportsCeil(usd: number, solUsd: number): bigint {
  if (!Number.isFinite(usd) || usd <= 0) throw new Error("usd must be positive");
  if (!Number.isFinite(solUsd) || solUsd <= 0) throw new Error("solUsd must be positive");
  const solNeeded = usd / solUsd;
  const lam = solNeeded * LAMPORTS_PER_SOL;
  return BigInt(Math.ceil(lam - 1e-9));
}
