import { resolveCopyTradeFeeRecipientPubkey } from "@/lib/copyTrade/execution/copyTradeFeeRecipient";
import { waitForSignature } from "@/lib/copyTrade/execution/confirmTx";
import { mergeIntentDetail } from "@/lib/copyTrade/execution/mergeIntentDetail";
import { copyTradeFeeOnSellBpsFromEnv } from "@/lib/copyTrade/platformFee";
import { loadCopyTradeUserKeypair } from "@/lib/copyTrade/userWalletService";
import {
  jupiterQuoteExactIn,
  jupiterSwapTransactionBase64,
  SOL_MINT_MAINNET,
  type JupiterQuote,
} from "@/lib/copyTrade/execution/jupiterSolBuy";
import { sendNativeLamportsTransfer } from "@/lib/copyTrade/execution/nativeSolTransfer";
import { getTokenRawBalanceForMint } from "@/lib/copyTrade/execution/rpcTokenBalance";
import { parseSellRules, type CopySellRule } from "@/lib/copyTrade/sellRules";
import { solanaRpcUrlServer } from "@/lib/solanaEnv";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

function quoteOutLamports(q: JupiterQuote): bigint | null {
  const o = q.outAmount;
  if (typeof o === "string") {
    const t = o.trim();
    if (!/^\d+$/.test(t)) return null;
    try {
      return BigInt(t);
    } catch {
      return null;
    }
  }
  if (typeof o === "number" && Number.isFinite(o) && o >= 0) {
    try {
      return BigInt(Math.floor(o));
    } catch {
      return null;
    }
  }
  return null;
}

function fractionOfRaw(balance: bigint, fraction: number): bigint {
  if (balance <= BigInt(0)) return BigInt(0);
  if (fraction >= 1) return balance;
  if (!Number.isFinite(fraction) || fraction <= 0) return BigInt(0);
  const micros = Math.min(1_000_000, Math.max(1, Math.round(fraction * 1_000_000)));
  return (balance * BigInt(micros)) / BigInt(1_000_000);
}

function rulesFromSnapshot(raw: unknown): CopySellRule[] {
  const p = parseSellRules(raw);
  return p.ok ? p.rules : [];
}

export type SellPassPositionRow = {
  id: string;
  strategy_id: string;
  discord_user_id: string;
  mint: string;
  entry_buy_lamports: string | number;
  sell_rules_snapshot: unknown;
  next_rule_index: number;
  detail: unknown;
};

/**
 * One pass over open positions: at most **one** milestone sell per position (next cron continues).
 * Multiple is Jupiter-implied: quote selling 100% of balance → SOL lamports ÷ entry buy lamports.
 * Each position signs with that user's custodial copy-trade wallet.
 */
export async function runCopyTradeSellPass(db: SupabaseClient, limit: number): Promise<{ results: Record<string, unknown>[] }> {
  const lim = Math.max(1, Math.min(20, Math.floor(limit)));
  const { data: rows, error } = await db
    .from("copy_trade_positions")
    .select("id,strategy_id,discord_user_id,mint,entry_buy_lamports,sell_rules_snapshot,next_rule_index,detail")
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(lim);

  if (error) {
    console.error("[copyTrade] sell pass list positions", error);
    return { results: [] };
  }

  const list = Array.isArray(rows) ? rows : [];
  const rpc = solanaRpcUrlServer();
  const connection = new Connection(rpc, "confirmed");
  const results: Record<string, unknown>[] = [];

  const abortMs = Math.min(90_000, Math.max(10_000, Number(process.env.COPY_TRADE_JUPITER_TIMEOUT_MS ?? 28_000) || 28_000));
  const confirmMs = Math.min(120_000, Math.max(15_000, Number(process.env.COPY_TRADE_CONFIRM_TIMEOUT_MS ?? 55_000) || 55_000));

  for (const raw of list) {
    const pos = raw as SellPassPositionRow;
    const posId = String(pos.id);
    const mintStr = String(pos.mint || "").trim();
    let mintPk: PublicKey;
    try {
      mintPk = new PublicKey(mintStr);
    } catch {
      results.push({ positionId: posId, outcome: "error", error: "bad_mint" });
      continue;
    }

    let entryLamports: bigint;
    try {
      entryLamports = BigInt(String(pos.entry_buy_lamports ?? 0));
    } catch {
      results.push({ positionId: posId, outcome: "error", error: "bad_entry" });
      continue;
    }
    if (entryLamports <= BigInt(0)) {
      results.push({ positionId: posId, outcome: "error", error: "entry_zero" });
      continue;
    }

    const { data: stRow } = await db
      .from("copy_trade_strategies")
      .select("max_slippage_bps")
      .eq("id", String(pos.strategy_id))
      .maybeSingle();
    const slip = Math.max(
      0,
      Math.min(5000, Math.floor(Number((stRow as { max_slippage_bps?: number } | null)?.max_slippage_bps ?? 800)))
    );
    const feeOnSellBps = copyTradeFeeOnSellBpsFromEnv();

    const discordUserId = String(pos.discord_user_id ?? "").trim();
    const keypair = discordUserId ? await loadCopyTradeUserKeypair(db, discordUserId) : null;
    if (!keypair) {
      results.push({ positionId: posId, outcome: "error", error: "no_copy_trade_wallet" });
      continue;
    }
    const owner = keypair.publicKey;

    const rules = rulesFromSnapshot(pos.sell_rules_snapshot);
    let nextIdx = Math.max(0, Math.floor(Number(pos.next_rule_index ?? 0)));
    let workingDetail: unknown = pos.detail;

    if (!rules.length) {
      await db
        .from("copy_trade_positions")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", posId);
      results.push({ positionId: posId, outcome: "closed", reason: "no_rules" });
      continue;
    }

    if (nextIdx >= rules.length) {
      await db
        .from("copy_trade_positions")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", posId);
      results.push({ positionId: posId, outcome: "closed", reason: "rules_complete" });
      continue;
    }

    const balance = await getTokenRawBalanceForMint(connection, owner, mintPk);
    if (balance <= BigInt(0)) {
      await db
        .from("copy_trade_positions")
        .update({
          status: "closed",
          updated_at: new Date().toISOString(),
          detail: mergeIntentDetail(workingDetail, { sell: "zero_balance" }),
        })
        .eq("id", posId);
      results.push({ positionId: posId, outcome: "closed", reason: "no_tokens" });
      continue;
    }

    const rule = rules[nextIdx]!;

    const ac0 = new AbortController();
    const t0 = setTimeout(() => ac0.abort(), abortMs);
    let fullQ: Awaited<ReturnType<typeof jupiterQuoteExactIn>>;
    try {
      fullQ = await jupiterQuoteExactIn({
        inputMint: mintStr,
        outputMint: SOL_MINT_MAINNET,
        amountRaw: balance,
        slippageBps: slip,
        signal: ac0.signal,
      });
    } finally {
      clearTimeout(t0);
    }

    if (!fullQ.ok) {
      results.push({ positionId: posId, outcome: "hold", error: fullQ.error });
      continue;
    }

    const impliedSol = quoteOutLamports(fullQ.quote);
    if (impliedSol == null) {
      results.push({ positionId: posId, outcome: "hold", error: "no_out_amount" });
      continue;
    }

    const ratio = Number(impliedSol) / Number(entryLamports);
    if (!Number.isFinite(ratio) || ratio + 1e-12 < rule.multiple) {
      results.push({ positionId: posId, outcome: "hold", ruleIndex: nextIdx, impliedMultiple: ratio });
      continue;
    }

    const sellRaw = fractionOfRaw(balance, rule.sell_fraction);
    if (sellRaw <= BigInt(0)) {
      nextIdx += 1;
      await db
        .from("copy_trade_positions")
        .update({
          next_rule_index: nextIdx,
          updated_at: new Date().toISOString(),
          status: nextIdx >= rules.length ? "closed" : "open",
        })
        .eq("id", posId);
      results.push({ positionId: posId, outcome: "skipped_rule", ruleIndex: nextIdx - 1, reason: "dust_sell_size" });
      continue;
    }

    const ac1 = new AbortController();
    const t1 = setTimeout(() => ac1.abort(), abortMs);
    let partQ: Awaited<ReturnType<typeof jupiterQuoteExactIn>>;
    try {
      partQ = await jupiterQuoteExactIn({
        inputMint: mintStr,
        outputMint: SOL_MINT_MAINNET,
        amountRaw: sellRaw,
        slippageBps: slip,
        signal: ac1.signal,
      });
    } finally {
      clearTimeout(t1);
    }

    if (!partQ.ok) {
      workingDetail = mergeIntentDetail(workingDetail, { last_sell_error: partQ.error });
      await db
        .from("copy_trade_positions")
        .update({ updated_at: new Date().toISOString(), detail: workingDetail })
        .eq("id", posId);
      results.push({ positionId: posId, outcome: "sell_quote_failed", error: partQ.error });
      continue;
    }

    const ac2 = new AbortController();
    const t2 = setTimeout(() => ac2.abort(), abortMs);
    let swapRes: Awaited<ReturnType<typeof jupiterSwapTransactionBase64>>;
    try {
      swapRes = await jupiterSwapTransactionBase64({
        quote: partQ.quote,
        userPublicKey: owner.toBase58(),
        signal: ac2.signal,
      });
    } finally {
      clearTimeout(t2);
    }

    if (!swapRes.ok) {
      workingDetail = mergeIntentDetail(workingDetail, { last_sell_error: swapRes.error });
      await db
        .from("copy_trade_positions")
        .update({ updated_at: new Date().toISOString(), detail: workingDetail })
        .eq("id", posId);
      results.push({ positionId: posId, outcome: "sell_swap_failed", error: swapRes.error });
      continue;
    }

    let vtx: VersionedTransaction;
    try {
      vtx = VersionedTransaction.deserialize(Buffer.from(swapRes.swapTransaction, "base64"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ positionId: posId, outcome: "sell_tx_bad", error: msg });
      continue;
    }
    vtx.sign([keypair]);
    let sig: string;
    try {
      sig = await connection.sendRawTransaction(vtx.serialize(), { skipPreflight: false, maxRetries: 3 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ positionId: posId, outcome: "sell_send_failed", error: msg });
      continue;
    }
    try {
      await waitForSignature(connection, sig, confirmMs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ positionId: posId, outcome: "sell_confirm_failed", signature: sig, error: msg });
      continue;
    }

    const quotedOutSol = quoteOutLamports(partQ.quote);
    let feePatch: Record<string, unknown> = {};
    if (feeOnSellBps > 0 && quotedOutSol != null && quotedOutSol > BigInt(0)) {
      const recipient = resolveCopyTradeFeeRecipientPubkey();
      if (!recipient) {
        feePatch = { last_fee_skipped: "no_recipient" };
      } else {
        let feeLamports = (quotedOutSol * BigInt(feeOnSellBps)) / BigInt(10000);
        const minFee = BigInt(5000);
        if (feeLamports < minFee) {
          feePatch = { last_fee_skipped: "below_min_lamports" };
        } else {
          if (feeLamports > quotedOutSol) feeLamports = quotedOutSol;
          const xfer = await sendNativeLamportsTransfer({
            connection,
            from: keypair,
            to: recipient,
            lamports: feeLamports,
            confirmMs,
          });
          if (xfer.ok) {
            feePatch = {
              last_fee_signature: xfer.signature,
              last_fee_lamports: xfer.sentLamports.toString(),
              last_fee_bps: feeOnSellBps,
            };
          } else {
            feePatch = { last_fee_error: xfer.error };
          }
        }
      }
    }

    nextIdx += 1;
    const iso = new Date().toISOString();
    const prevSells =
      workingDetail &&
      typeof workingDetail === "object" &&
      !Array.isArray(workingDetail) &&
      Array.isArray((workingDetail as Record<string, unknown>).sells)
        ? ([...(workingDetail as { sells: unknown[] }).sells] as unknown[])
        : [];
    prevSells.push({
      at: iso,
      signature: sig,
      multiple: rule.multiple,
      fraction: rule.sell_fraction,
    });
    workingDetail = mergeIntentDetail(mergeIntentDetail(workingDetail, feePatch), {
      last_sell_at: iso,
      last_sell_signature: sig,
      sells: prevSells,
    });

    const closed = nextIdx >= rules.length;
    await db
      .from("copy_trade_positions")
      .update({
        next_rule_index: nextIdx,
        status: closed ? "closed" : "open",
        updated_at: iso,
        detail: workingDetail,
      })
      .eq("id", posId);

    results.push({
      positionId: posId,
      outcome: "sold",
      signature: sig,
      ruleIndex: nextIdx - 1,
      positionClosed: closed,
      ...(typeof feePatch.last_fee_signature === "string"
        ? { feeSignature: feePatch.last_fee_signature as string }
        : {}),
    });
  }

  return { results };
}
