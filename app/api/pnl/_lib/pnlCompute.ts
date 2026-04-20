import { Connection, PublicKey } from "@solana/web3.js";

export type PnlTrade = {
  signature: string;
  kind: "buy" | "sell";
  tokenDelta: number; // token units (ui)
  solDelta: number; // SOL (ui)
};

export type PnlComputeResult = {
  wallet: string;
  tokenCa: string;
  avgCostMethod: "average_cost";
  costBasisSol: number;
  proceedsSol: number;
  realizedPnlSol: number;
  realizedPnlPct: number;
  unrealizedPnlSol: number;
  unrealizedPnlPct: number;
  qtyRemainingBaseUnits: string;
  qtyRemainingUi: number;
  pricePerTokenSol: number | null;
  signatures: string[];
  trades: PnlTrade[];
};

function rpcUrl(): string {
  return (process.env.SOLANA_RPC_URL ?? "").trim() || "https://api.mainnet-beta.solana.com";
}

function safeNum(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function lamportsToSol(l: number): number {
  return l / 1e9;
}

function pickOwnerTokenDelta(tx: any, owner: string, mint: string): { deltaUi: number; deltaBase: bigint } | null {
  const pre = Array.isArray(tx?.meta?.preTokenBalances) ? tx.meta.preTokenBalances : [];
  const post = Array.isArray(tx?.meta?.postTokenBalances) ? tx.meta.postTokenBalances : [];

  const preRow = pre.find((b: any) => String(b?.owner ?? "") === owner && String(b?.mint ?? "") === mint);
  const postRow = post.find((b: any) => String(b?.owner ?? "") === owner && String(b?.mint ?? "") === mint);

  const preAmount = preRow?.uiTokenAmount?.amount ?? "0";
  const postAmount = postRow?.uiTokenAmount?.amount ?? "0";
  const decimals =
    typeof (postRow?.uiTokenAmount?.decimals) === "number"
      ? postRow.uiTokenAmount.decimals
      : typeof (preRow?.uiTokenAmount?.decimals) === "number"
        ? preRow.uiTokenAmount.decimals
        : 0;
  let preBase = BigInt(0);
  let postBase = BigInt(0);
  try {
    preBase = BigInt(String(preAmount));
    postBase = BigInt(String(postAmount));
  } catch {
    return null;
  }
  const deltaBase = postBase - preBase;
  const deltaUi = Number(deltaBase) / Math.pow(10, decimals);
  return { deltaUi, deltaBase };
}

function ownerSolDelta(tx: any, owner: string): number | null {
  const keys = tx?.transaction?.message?.accountKeys;
  if (!Array.isArray(keys)) return null;
  const idx = keys.findIndex((k: any) => String(k?.pubkey?.toBase58?.() ?? k?.pubkey ?? k) === owner);
  if (idx < 0) return null;
  const pre = tx?.meta?.preBalances?.[idx];
  const post = tx?.meta?.postBalances?.[idx];
  if (typeof pre !== "number" || typeof post !== "number") return null;
  const fee = typeof tx?.meta?.fee === "number" ? tx.meta.fee : 0;
  // remove fee from delta for cleaner swap SOL delta
  return lamportsToSol(post - pre + fee);
}

export async function computeVerifiedPnlAverageCost(args: {
  walletPubkey: string;
  tokenCa: string;
  pricePerTokenSol: number | null;
}): Promise<PnlComputeResult> {
  const walletPk = new PublicKey(args.walletPubkey);
  const owner = walletPk.toBase58();
  const mint = args.tokenCa.trim();
  const conn = new Connection(rpcUrl(), "confirmed");

  const sigs = await conn.getSignaturesForAddress(walletPk, { limit: 60 }).catch(() => []);
  const trades: PnlTrade[] = [];
  const supportingSigs: string[] = [];

  // Running average-cost model in UI units.
  let qtyUi = 0;
  let costSol = 0;
  let proceedsSol = 0;
  let realizedSol = 0;
  let qtyBase = BigInt(0);

  for (const s of sigs) {
    const signature = s.signature;
    if (!signature) continue;
    const tx = await conn.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 }).catch(() => null);
    if (!tx) continue;
    const tokenDelta = pickOwnerTokenDelta(tx, owner, mint);
    if (!tokenDelta) continue;
    if (tokenDelta.deltaBase === BigInt(0)) continue;
    const solDelta = ownerSolDelta(tx, owner);
    if (solDelta == null) continue;

    const tokenDeltaUi = tokenDelta.deltaUi;

    // Heuristic: buy = token up + sol down; sell = token down + sol up
    if (tokenDeltaUi > 0 && solDelta < 0) {
      const solSpent = Math.abs(solDelta);
      qtyUi += tokenDeltaUi;
      qtyBase += tokenDelta.deltaBase;
      costSol += solSpent;
      trades.push({ signature, kind: "buy", tokenDelta: tokenDeltaUi, solDelta });
      supportingSigs.push(signature);
    } else if (tokenDeltaUi < 0 && solDelta > 0) {
      const sellQty = Math.abs(tokenDeltaUi);
      if (qtyUi <= 0) continue;
      const avgCostPerToken = costSol / qtyUi;
      const costOfSold = avgCostPerToken * sellQty;
      const solReceived = solDelta;
      proceedsSol += solReceived;
      realizedSol += solReceived - costOfSold;
      qtyUi -= sellQty;
      costSol -= costOfSold;
      qtyBase += tokenDelta.deltaBase; // deltaBase is negative for sell
      trades.push({ signature, kind: "sell", tokenDelta: tokenDeltaUi, solDelta });
      supportingSigs.push(signature);
    }
  }

  const price = args.pricePerTokenSol;
  const marketValue = price != null ? qtyUi * price : 0;
  const unrealizedSol = price != null ? marketValue - costSol : 0;

  const realizedPct = costSol + proceedsSol > 0 ? (realizedSol / Math.max(1e-9, (proceedsSol > 0 ? proceedsSol : costSol))) * 100 : 0;
  const unrealizedPct = costSol > 0 && price != null ? (unrealizedSol / costSol) * 100 : 0;

  return {
    wallet: owner,
    tokenCa: mint,
    avgCostMethod: "average_cost",
    costBasisSol: safeNum(costSol),
    proceedsSol: safeNum(proceedsSol),
    realizedPnlSol: safeNum(realizedSol),
    realizedPnlPct: safeNum(realizedPct),
    unrealizedPnlSol: safeNum(unrealizedSol),
    unrealizedPnlPct: safeNum(unrealizedPct),
    qtyRemainingBaseUnits: qtyBase.toString(),
    qtyRemainingUi: safeNum(qtyUi),
    pricePerTokenSol: price,
    signatures: supportingSigs.slice(0, 20),
    trades: trades.slice(0, 40),
  };
}

