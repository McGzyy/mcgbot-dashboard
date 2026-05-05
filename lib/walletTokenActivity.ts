import { PublicKey, type Connection, type ParsedTransactionWithMeta } from "@solana/web3.js";

export type WalletTokenActivityRow = {
  signature: string;
  blockTime: number | null;
  /** SPL mints touched by this wallet in the tx (excludes SOL wrap + USDC). */
  mints: string[];
};

const WSOL = "So11111111111111111111111111111111111111112";

function mintsForOwner(
  tx: ParsedTransactionWithMeta | null,
  ownerBase58: string,
  ignoreMints: Set<string>
): string[] {
  if (!tx?.meta) return [];
  const seen = new Set<string>();
  const buckets = [
    ...(tx.meta.preTokenBalances ?? []),
    ...(tx.meta.postTokenBalances ?? []),
  ];
  for (const b of buckets) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    if (o.owner !== ownerBase58) continue;
    const mint = typeof o.mint === "string" ? o.mint.trim() : "";
    if (!mint || ignoreMints.has(mint)) continue;
    seen.add(mint);
  }
  return [...seen];
}

/**
 * Best-effort: recent signatures for a wallet, then parse parsed transactions for SPL mints
 * the wallet touched. Uses the same RPC stack as wallet balances (no extra vendor).
 */
export async function fetchWalletTokenActivityRows(
  connection: Connection,
  ownerBase58: string,
  usdcMint: string,
  opts: { signatureScan: number; txDepth: number }
): Promise<WalletTokenActivityRow[]> {
  const ownerPkStr = ownerBase58.trim();
  if (!ownerPkStr) return [];

  let ownerPk: PublicKey;
  try {
    ownerPk = new PublicKey(ownerPkStr);
  } catch {
    return [];
  }

  const ignore = new Set<string>([WSOL, usdcMint].filter(Boolean));

  const sigs = await connection.getSignaturesForAddress(ownerPk, {
    limit: opts.signatureScan,
  });

  const out: WalletTokenActivityRow[] = [];
  const seenSig = new Set<string>();

  for (const s of sigs) {
    if (!s?.signature || seenSig.has(s.signature)) continue;
    seenSig.add(s.signature);
    if (out.length >= opts.txDepth) break;

    let tx: ParsedTransactionWithMeta | null = null;
    try {
      tx = await connection.getParsedTransaction(s.signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
    } catch {
      continue;
    }

    const mints = mintsForOwner(tx, ownerPkStr, ignore);
    if (mints.length === 0) continue;

    const blockTime =
      typeof s.blockTime === "number" && Number.isFinite(s.blockTime) ? s.blockTime : null;

    out.push({ signature: s.signature, blockTime, mints });
  }

  return dedupeWalletTokenActivityRows(out);
}

/** Same signature should never appear twice; collapse if it does. */
function dedupeBySignature(rows: WalletTokenActivityRow[]): WalletTokenActivityRow[] {
  const seen = new Set<string>();
  const next: WalletTokenActivityRow[] = [];
  for (const r of rows) {
    if (seen.has(r.signature)) continue;
    seen.add(r.signature);
    next.push(r);
  }
  return next;
}

/**
 * Collapse rows that look identical in the UI: same chain time + same mint set.
 * Keeps the first row (newest — list is built newest-first from signatures).
 */
function dedupeByBlockTimeAndMints(rows: WalletTokenActivityRow[]): WalletTokenActivityRow[] {
  const seen = new Set<string>();
  const next: WalletTokenActivityRow[] = [];
  for (const r of rows) {
    const mintKey = [...r.mints].sort().join(",");
    const fp = `${r.blockTime ?? "na"}|${mintKey}`;
    if (seen.has(fp)) continue;
    seen.add(fp);
    next.push(r);
  }
  return next;
}

export function dedupeWalletTokenActivityRows(rows: WalletTokenActivityRow[]): WalletTokenActivityRow[] {
  return dedupeByBlockTimeAndMints(dedupeBySignature(rows));
}
