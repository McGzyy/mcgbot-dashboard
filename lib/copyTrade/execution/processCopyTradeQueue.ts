import { processCopyTradeIntent, type ProcessIntentResult } from "@/lib/copyTrade/execution/processCopyTradeIntent";
import type { SupabaseClient } from "@supabase/supabase-js";

export function isCopyTradeExecutionEnabled(): boolean {
  return process.env.COPY_TRADE_EXECUTION_ENABLED?.trim().toLowerCase() === "true";
}

/**
 * Re-queue intents stuck in `processing` (e.g. worker crash after claim, before completion).
 */
export async function recoverStaleCopyTradeIntents(db: SupabaseClient, staleMs: number): Promise<number> {
  if (!Number.isFinite(staleMs) || staleMs < 60_000) return 0;
  const cutoff = new Date(Date.now() - staleMs).toISOString();
  const { data, error } = await db
    .from("copy_trade_intents")
    .update({
      status: "queued",
      started_at: null,
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("status", "processing")
    .not("started_at", "is", null)
    .lt("started_at", cutoff)
    .select("id");

  if (error) {
    console.error("[copyTrade] recover stale intents", error);
    return 0;
  }
  return Array.isArray(data) ? data.length : 0;
}

export async function runCopyTradeQueue(opts: {
  db: SupabaseClient;
  limit: number;
  recoverStaleMs?: number;
}): Promise<{ recovered: number; results: ProcessIntentResult[] }> {
  let recovered = 0;
  if (opts.recoverStaleMs != null && opts.recoverStaleMs > 0) {
    recovered = await recoverStaleCopyTradeIntents(opts.db, opts.recoverStaleMs);
  }

  const lim = Math.max(1, Math.min(15, Math.floor(opts.limit)));
  const { data: rows, error } = await opts.db
    .from("copy_trade_intents")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(lim);

  if (error) {
    console.error("[copyTrade] list queued intents", error);
    return { recovered, results: [] };
  }

  const ids = (Array.isArray(rows) ? rows : [])
    .map((r: { id?: string }) => String(r.id ?? "").trim())
    .filter(Boolean);

  const results: ProcessIntentResult[] = [];
  for (const intentId of ids) {
    const r = await processCopyTradeIntent(opts.db, intentId);
    if (r.outcome === "not_claimed") continue;
    results.push(r);
  }
  return { recovered, results };
}
