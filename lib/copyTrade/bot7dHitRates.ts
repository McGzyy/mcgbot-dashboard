import {
  CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR,
  isCallPerformanceRowEligibleForStats,
} from "@/lib/callPerformanceDashboardVisibility";
import { rowCallTimeUtcMs } from "@/lib/callPerformanceLeaderboard";
import { rowAthMultiple } from "@/lib/callPerformanceMultiples";
import { mergeStatsCutoverIntoMin } from "@/lib/statsCutover";
import type { SupabaseClient } from "@supabase/supabase-js";

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type BotHitRateTier = { multiple: number; label: string; hitPct: number };

export type Bot7dHitRatesResult = {
  totalCalls: number;
  tiers: BotHitRateTier[];
  botStatsDiscordId: string;
};

const DEFAULT_TIERS = [1.5, 2, 5, 10] as const;

function hitPctForThreshold(rows: Record<string, unknown>[], threshold: number, nowMs: number): number {
  let n = 0;
  let hits = 0;
  for (const r of rows) {
    if (!isCallPerformanceRowEligibleForStats(r)) continue;
    const t = rowCallTimeUtcMs(r);
    if (t <= 0 || nowMs < t || nowMs - t >= WINDOW_MS) continue;
    const m = rowAthMultiple(r);
    if (!Number.isFinite(m) || m <= 0) continue;
    n += 1;
    if (m + 1e-12 >= threshold) hits += 1;
  }
  return n > 0 ? Math.round((hits / n) * 1000) / 10 : 0;
}

/**
 * Rolling 7d bot-call hit rates at ATH multiple thresholds (same eligibility as public stats).
 */
export async function fetchBot7dHitRates(
  db: SupabaseClient,
  opts: { botStatsDiscordId: string; nowMs?: number; cutoverUtcMs: number | null }
): Promise<Bot7dHitRatesResult | null> {
  const id = opts.botStatsDiscordId.trim();
  if (!id) return null;

  const nowMs = opts.nowMs ?? Date.now();
  const floorMs = mergeStatsCutoverIntoMin(nowMs - WINDOW_MS, opts.cutoverUtcMs);

  const { data, error } = await db
    .from("call_performance")
    .select("ath_multiple,call_time,excluded_from_stats,hidden_from_dashboard")
    .eq("source", "bot")
    .eq("discord_id", id)
    .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR)
    .gte("call_time", floorMs);

  if (error) {
    console.error("[copyTrade] fetchBot7dHitRates", error.message);
    return null;
  }

  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  let totalCalls = 0;
  for (const r of rows) {
    if (!isCallPerformanceRowEligibleForStats(r)) continue;
    const t = rowCallTimeUtcMs(r);
    if (t <= 0 || nowMs < t || nowMs - t >= WINDOW_MS) continue;
    const m = rowAthMultiple(r);
    if (!Number.isFinite(m) || m <= 0) continue;
    totalCalls += 1;
  }

  const tiers: BotHitRateTier[] = DEFAULT_TIERS.map((mult) => ({
    multiple: mult,
    label: mult % 1 !== 0 ? `${mult}x` : `${Math.round(mult)}x`,
    hitPct: hitPctForThreshold(rows, mult, nowMs),
  }));

  return { totalCalls, tiers, botStatsDiscordId: id };
}
