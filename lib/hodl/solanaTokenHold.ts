import { Connection, PublicKey } from "@solana/web3.js";
import {
  HODL_MIN_RAW_AMOUNT,
  HODL_SIG_PAGE_LIMIT,
  HODL_SIG_SCAN_MAX_PAGES,
} from "@/lib/hodl/hodlConstants";

export type TokenHoldScan = {
  tokenAccount: string;
  balanceRaw: bigint;
  decimals: number;
  symbol: string | null;
  /** Oldest `blockTime` seen while scanning recent signatures (approximate hold anchor). */
  oldestBlockTimeSec: number | null;
};

function parsedTokenAmount(
  parsed: unknown
): { amount: string; decimals: number; uiAmountString?: string } | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  const type = typeof p.type === "string" ? p.type : "";
  if (type !== "account") return null;
  const data = p.data;
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const parsedInner = d.parsed;
  if (!parsedInner || typeof parsedInner !== "object") return null;
  const info = (parsedInner as Record<string, unknown>).info;
  if (!info || typeof info !== "object") return null;
  const tokenAmount = (info as Record<string, unknown>).tokenAmount;
  if (!tokenAmount || typeof tokenAmount !== "object") return null;
  const ta = tokenAmount as Record<string, unknown>;
  const amount = typeof ta.amount === "string" ? ta.amount : "";
  const decimals = typeof ta.decimals === "number" ? ta.decimals : Number(ta.decimals);
  if (!amount || !Number.isFinite(decimals)) return null;
  const uiAmountString = typeof ta.uiAmountString === "string" ? ta.uiAmountString : undefined;
  return { amount, decimals, uiAmountString };
}

/**
 * Largest SPL token balance for `mint` owned by `owner` (mainnet-style parsed accounts).
 */
export async function scanSplHoldForMint(
  conn: Connection,
  owner: PublicKey,
  mint: PublicKey
): Promise<TokenHoldScan | null> {
  const res = await conn.getParsedTokenAccountsByOwner(owner, { mint }, "confirmed");
  const accounts = res.value ?? [];
  let best: { pubkey: PublicKey; amount: bigint; decimals: number; symbol: string | null } | null =
    null;

  for (const { pubkey, account } of accounts) {
    const parsed = account.data;
    const ta = parsedTokenAmount(parsed as unknown);
    if (!ta) continue;
    let raw: bigint;
    try {
      raw = BigInt(ta.amount);
    } catch {
      continue;
    }
    if (raw < HODL_MIN_RAW_AMOUNT) continue;
    if (!best || raw > best.amount) {
      let symbol: string | null = null;
      try {
        const info = (parsed as { parsed?: { info?: { tokenAmount?: unknown; mint?: string } } })
          .parsed?.info as Record<string, unknown> | undefined;
        const ext = info?.tokenAmount;
        // optional: no standard symbol in parsed token account
        void ext;
      } catch {
        symbol = null;
      }
      best = { pubkey, amount: raw, decimals: ta.decimals, symbol };
    }
  }

  if (!best) return null;

  let oldestBlockTimeSec: number | null = null;
  let before: string | undefined;
  for (let page = 0; page < HODL_SIG_SCAN_MAX_PAGES; page++) {
    const sigs = await conn.getSignaturesForAddress(best.pubkey, {
      limit: HODL_SIG_PAGE_LIMIT,
      before,
    });
    if (!sigs.length) break;
    for (const s of sigs) {
      if (typeof s.blockTime === "number" && Number.isFinite(s.blockTime)) {
        if (oldestBlockTimeSec === null || s.blockTime < oldestBlockTimeSec) {
          oldestBlockTimeSec = s.blockTime;
        }
      }
    }
    before = sigs[sigs.length - 1]?.signature;
    if (sigs.length < HODL_SIG_PAGE_LIMIT) break;
  }

  return {
    tokenAccount: best.pubkey.toBase58(),
    balanceRaw: best.amount,
    decimals: best.decimals,
    symbol: best.symbol,
    oldestBlockTimeSec,
  };
}

export function holdSinceFromOldestBlockTime(oldestBlockTimeSec: number | null): Date | null {
  if (oldestBlockTimeSec == null || !Number.isFinite(oldestBlockTimeSec)) return null;
  return new Date(oldestBlockTimeSec * 1000);
}
