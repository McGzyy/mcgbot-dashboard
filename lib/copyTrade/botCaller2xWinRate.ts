import {
  CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR,
  isCallPerformanceRowEligibleForStats,
} from "@/lib/callPerformanceDashboardVisibility";
import { rowCallTimeUtcMs } from "@/lib/callPerformanceLeaderboard";
import { rowAthMultiple } from "@/lib/callPerformanceMultiples";
import { mergeStatsCutoverIntoMin } from "@/lib/statsCutover";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Rolling window for copy-trade “min bot 2× win %” (aligned with common “last 90d” framing). */
export const COPY_TRADE_BOT_2X_WIN_RATE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

/** Do not enforce the threshold until at least this many eligible bot calls in the window. */
export const COPY_TRADE_BOT_2X_MIN_SAMPLE = 5;

export type BotCaller2xWinRateResult = {
  winRatePct: number;
  sampleTotal: number;
  hits2x: number;
  insufficientSample: boolean;
};

function statsForWindow(
  rows: Record<string, unknown>[],
  windowMs: number,
  nowMs: number
): { sampleTotal: number; hits2x: number; winRatePct: number } {
  let sampleTotal = 0;
  let hits2x = 0;
  for (const r of rows) {
    if (!isCallPerformanceRowEligibleForStats(r)) continue;
    const t = rowCallTimeUtcMs(r);
    if (t <= 0 || nowMs < t || nowMs - t >= windowMs) continue;
    const mult = rowAthMultiple(r);
    if (!Number.isFinite(mult) || mult <= 0) continue;
    sampleTotal += 1;
    if (mult >= 2) hits2x += 1;
  }
  const winRatePct = sampleTotal > 0 ? (hits2x / sampleTotal) * 100 : 0;
  return { sampleTotal, hits2x, winRatePct };
}

/**
 * Bot caller ATH ≥ 2× hit rate over a rolling UTC window, same eligibility rules as public stats.
 * Uses `call_time >= max(cutover, now - window)` server-side to limit payload size.
 */
export async function fetchBotCaller2xWinRate(
  db: SupabaseClient,
  opts: {
    botStatsDiscordId: string;
    windowMs?: number;
    nowMs?: number;
    cutoverUtcMs: number | null;
  }
): Promise<BotCaller2xWinRateResult | null> {
  const id = opts.botStatsDiscordId.trim();
  if (!id) return null;

  const windowMs = opts.windowMs ?? COPY_TRADE_BOT_2X_WIN_RATE_WINDOW_MS;
  const nowMs = opts.nowMs ?? Date.now();
  const floorMs = mergeStatsCutoverIntoMin(nowMs - windowMs, opts.cutoverUtcMs);

  const { data, error } = await db
    .from("call_performance")
    .select("ath_multiple,call_time,excluded_from_stats,hidden_from_dashboard")
    .eq("source", "bot")
    .eq("discord_id", id)
    .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR)
    .gte("call_time", floorMs);

  if (error) {
    console.error("[copyTrade] fetchBotCaller2xWinRate", error.message);
    return null;
  }

  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  const { sampleTotal, hits2x, winRatePct } = statsForWindow(rows, windowMs, nowMs);
  return {
    winRatePct,
    sampleTotal,
    hits2x,
    insufficientSample: sampleTotal < COPY_TRADE_BOT_2X_MIN_SAMPLE,
  };
}
