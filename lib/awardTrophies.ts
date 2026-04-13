import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateCallPerformanceRows,
  fetchCallPerformanceForSource,
  filterRowsByMinCallTimeUtc,
  rankTopN,
} from "@/lib/callPerformanceLeaderboard";
import { periodStartMsForTrophyTimeframe } from "@/lib/leaderboardTimeWindows";

export type TrophyTimeframe = "daily" | "weekly" | "monthly";

export type AwardTrophiesLeader = {
  userId: string;
  rank: number;
  avgX: number;
};

export type AwardTrophiesResult = {
  periodStartMs: number;
  /** Rows written or skipped as duplicate (Supabase may omit skipped from `select`). */
  inserted: number;
  leaders: AwardTrophiesLeader[];
  error: Error | null;
};

/**
 * Inserts top-3 leaderboard trophies for a timeframe (same windows as weekly/monthly leader APIs).
 *
 * TODO: run automatically via cron job (e.g. after UTC day / week / month closes).
 */
export async function awardTrophies(
  supabase: SupabaseClient,
  timeframe: TrophyTimeframe,
  options?: { nowMs?: number; source?: string }
): Promise<AwardTrophiesResult> {
  const nowMs = options?.nowMs ?? Date.now();
  const source = options?.source ?? "user";
  const periodStartMs = periodStartMsForTrophyTimeframe(timeframe, nowMs);

  const { rows, error: fetchErr } =
    await fetchCallPerformanceForSource(supabase, source);
  if (fetchErr) {
    return {
      periodStartMs,
      inserted: 0,
      leaders: [],
      error: fetchErr,
    };
  }

  const filtered = filterRowsByMinCallTimeUtc(rows, periodStartMs);
  const aggregated = aggregateCallPerformanceRows(filtered);
  const top3 = rankTopN(aggregated, 3);

  const leaders: AwardTrophiesLeader[] = top3.map((u) => ({
    userId: u.discordId,
    rank: u.rank,
    avgX: u.avgX,
  }));

  if (top3.length === 0) {
    return { periodStartMs, inserted: 0, leaders, error: null };
  }

  const payloads = top3.map((u) => ({
    user_id: u.discordId,
    rank: u.rank,
    timeframe,
    period_start_ms: periodStartMs,
  }));

  const { data, error: insErr } = await supabase
    .from("user_trophies")
    .upsert(payloads, {
      onConflict: "user_id,timeframe,period_start_ms",
      ignoreDuplicates: true,
    })
    .select("id");

  if (insErr) {
    return {
      periodStartMs,
      inserted: 0,
      leaders,
      error: new Error(insErr.message),
    };
  }

  return {
    periodStartMs,
    inserted: Array.isArray(data) ? data.length : 0,
    leaders,
    error: null,
  };
}
