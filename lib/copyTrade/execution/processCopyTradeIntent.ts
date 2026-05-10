import { mergeIntentDetail, truncateErrorMessage } from "@/lib/copyTrade/execution/mergeIntentDetail";
import { jupiterQuoteSolToMint, jupiterSwapTransactionBase64 } from "@/lib/copyTrade/execution/jupiterSolBuy";
import type { CopyTradeStrategyRow } from "@/lib/copyTrade/strategyService";
import { solanaRpcUrlServer } from "@/lib/solanaEnv";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";

export type ProcessIntentResult =
  | { outcome: "completed"; intentId: string; signature: string }
  | { outcome: "failed"; intentId: string; error: string }
  | { outcome: "skipped"; intentId: string; reason: string }
  | { outcome: "not_claimed" };

const DEFAULT_BUFFER_LAMPORTS = BigInt("50000000");
const DEFAULT_MIN_BUY_LAMPORTS = BigInt("1000000");

function balanceBufferLamports(): bigint {
  const raw = process.env.COPY_TRADE_EXECUTOR_BALANCE_BUFFER_LAMPORTS?.trim();
  if (!raw) return DEFAULT_BUFFER_LAMPORTS;
  try {
    const n = BigInt(raw);
    return n > BigInt(0) ? n : DEFAULT_BUFFER_LAMPORTS;
  } catch {
    return DEFAULT_BUFFER_LAMPORTS;
  }
}

function minBuyLamports(): bigint {
  const raw = process.env.COPY_TRADE_MIN_BUY_LAMPORTS?.trim();
  if (!raw) return DEFAULT_MIN_BUY_LAMPORTS;
  try {
    const n = BigInt(raw);
    return n > BigInt(0) ? n : DEFAULT_MIN_BUY_LAMPORTS;
  } catch {
    return DEFAULT_MIN_BUY_LAMPORTS;
  }
}

async function waitForSignature(connection: Connection, signature: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
    const s = r.value[0];
    if (s?.err) throw new Error(`tx_err:${JSON.stringify(s.err)}`);
    const st = s?.confirmationStatus;
    if (st === "confirmed" || st === "finalized") return;
    await new Promise((res) => setTimeout(res, 750));
  }
  throw new Error("confirmation_timeout");
}

const nowIso = () => new Date().toISOString();

function parseSolanaMint(mint: string): PublicKey | null {
  try {
    return new PublicKey(mint.trim());
  } catch {
    return null;
  }
}

/**
 * Claims one `queued` intent, loads strategy + signal, executes SOL→token buy via Jupiter v6, confirms on RPC.
 * Sell milestones are not executed here (later phase).
 */
export async function processCopyTradeIntent(
  db: SupabaseClient,
  keypair: Keypair,
  intentId: string
): Promise<ProcessIntentResult> {
  const started = nowIso();
  const { data: claimed, error: claimErr } = await db
    .from("copy_trade_intents")
    .update({
      status: "processing",
      started_at: started,
      updated_at: started,
    })
    .eq("id", intentId)
    .eq("status", "queued")
    .select("id,strategy_id,signal_id,discord_user_id,detail")
    .maybeSingle();

  if (claimErr) {
    console.error("[copyTrade] claim intent", claimErr);
    return { outcome: "not_claimed" };
  }
  if (!claimed) {
    return { outcome: "not_claimed" };
  }

  const id = String((claimed as { id: string }).id);
  const strategyId = String((claimed as { strategy_id: string }).strategy_id);
  const signalId = String((claimed as { signal_id: string }).signal_id);
  const priorDetail = (claimed as { detail: unknown }).detail;

  const fail = async (msg: string, code: string) => {
    const iso = nowIso();
    await db
      .from("copy_trade_intents")
      .update({
        status: "failed",
        updated_at: iso,
        completed_at: iso,
        error_message: truncateErrorMessage(msg),
        detail: mergeIntentDetail(priorDetail, { execution: "buy", error_code: code }),
      })
      .eq("id", id);
    return { outcome: "failed" as const, intentId: id, error: msg };
  };

  const skip = async (reason: string) => {
    const iso = nowIso();
    await db
      .from("copy_trade_intents")
      .update({
        status: "skipped",
        updated_at: iso,
        detail: mergeIntentDetail(priorDetail, { execution: "buy", skip_reason: reason }),
      })
      .eq("id", id);
    return { outcome: "skipped" as const, intentId: id, reason };
  };

  const [{ data: strategy, error: sErr }, { data: signal, error: gErr }] = await Promise.all([
    db.from("copy_trade_strategies").select("*").eq("id", strategyId).maybeSingle(),
    db.from("copy_trade_signals").select("id,call_ca").eq("id", signalId).maybeSingle(),
  ]);

  if (sErr || !strategy) {
    return await fail(sErr?.message ?? "strategy_missing", "strategy_missing");
  }
  if (gErr || !signal) {
    return await fail(gErr?.message ?? "signal_missing", "signal_missing");
  }

  const st = strategy as CopyTradeStrategyRow;
  if (st.enabled !== true) {
    return await skip("strategy_disabled_at_execution");
  }

  let maxBuy: bigint;
  try {
    maxBuy = BigInt(String(st.max_buy_lamports ?? 0));
  } catch {
    return await skip("invalid_max_buy_lamports");
  }
  if (maxBuy <= BigInt(0)) {
    return await skip("max_buy_zero");
  }

  const outputMint = String((signal as { call_ca?: string }).call_ca ?? "").trim();
  if (!outputMint) {
    return await fail("signal_missing_call_ca", "missing_call_ca");
  }

  if (!parseSolanaMint(outputMint)) {
    return await fail("invalid_output_mint", "invalid_mint");
  }

  const rpc = solanaRpcUrlServer();
  const connection = new Connection(rpc, "confirmed");

  let balanceBn: bigint;
  try {
    const lamports = await connection.getBalance(keypair.publicKey, "confirmed");
    balanceBn = BigInt(lamports);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return await fail(`balance_read:${msg}`, "rpc_balance");
  }

  const buffer = balanceBufferLamports();
  const minTrade = minBuyLamports();
  const zero = BigInt(0);
  const spendable = balanceBn > buffer ? balanceBn - buffer : zero;
  const tradeLamports = spendable < maxBuy ? spendable : maxBuy;

  if (tradeLamports < minTrade) {
    return await fail(
      `trade_amount_below_min (have ${tradeLamports.toString()} lamports after buffer; min ${minTrade.toString()})`,
      "below_min_buy"
    );
  }

  const slip = Math.max(0, Math.min(5000, Math.floor(Number(st.max_slippage_bps ?? 800))));
  const abortMs = Math.min(90_000, Math.max(10_000, Number(process.env.COPY_TRADE_JUPITER_TIMEOUT_MS ?? 28_000) || 28_000));
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), abortMs);

  let quoteRes: Awaited<ReturnType<typeof jupiterQuoteSolToMint>>;
  try {
    quoteRes = await jupiterQuoteSolToMint({
      outputMint,
      amountLamports: tradeLamports,
      slippageBps: slip,
      signal: ac.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!quoteRes.ok) {
    return await fail(quoteRes.error, "jupiter_quote");
  }

  const ac2 = new AbortController();
  const timer2 = setTimeout(() => ac2.abort(), abortMs);
  let swapRes: Awaited<ReturnType<typeof jupiterSwapTransactionBase64>>;
  try {
    swapRes = await jupiterSwapTransactionBase64({
      quote: quoteRes.quote,
      userPublicKey: keypair.publicKey.toBase58(),
      signal: ac2.signal,
    });
  } finally {
    clearTimeout(timer2);
  }

  if (!swapRes.ok) {
    return await fail(swapRes.error, "jupiter_swap");
  }

  let vtx: VersionedTransaction;
  try {
    vtx = VersionedTransaction.deserialize(Buffer.from(swapRes.swapTransaction, "base64"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return await fail(`deserialize_swap_tx:${msg}`, "tx_deserialize");
  }

  vtx.sign([keypair]);

  let signature: string;
  try {
    signature = await connection.sendRawTransaction(vtx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return await fail(`send_raw_tx:${msg}`, "send_failed");
  }

  const confirmMs = Math.min(120_000, Math.max(15_000, Number(process.env.COPY_TRADE_CONFIRM_TIMEOUT_MS ?? 55_000) || 55_000));
  try {
    await waitForSignature(connection, signature, confirmMs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return await fail(`confirm:${msg}`, "confirm_failed");
  }

  const iso = nowIso();
  const priceImpact =
    typeof quoteRes.quote.priceImpactPct === "string"
      ? quoteRes.quote.priceImpactPct
      : typeof quoteRes.quote.priceImpactPct === "number"
        ? String(quoteRes.quote.priceImpactPct)
        : undefined;

  await db
    .from("copy_trade_intents")
    .update({
      status: "completed",
      updated_at: iso,
      completed_at: iso,
      buy_signature: signature,
      buy_input_lamports: tradeLamports.toString(),
      executor_wallet: keypair.publicKey.toBase58(),
      error_message: null,
      detail: mergeIntentDetail(priorDetail, {
        execution: "buy",
        ok: true,
        jupiter_price_impact_pct: priceImpact,
        out_amount: typeof quoteRes.quote.outAmount === "string" ? quoteRes.quote.outAmount : undefined,
      }),
    })
    .eq("id", id);

  return { outcome: "completed", intentId: id, signature };
}
