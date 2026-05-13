import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateCallPerformanceRows,
  type AggregatedLeader,
  fetchCallPerformanceForSource,
  filterRowsByCallTimeWindow,
  rankTopN,
} from "@/lib/callPerformanceLeaderboard";
import { fetchDiscordIdsExcludedFromLeaderboards } from "@/lib/guildMembershipSync";
import { closedTrophyWindowUtcMs } from "@/lib/leaderboardTimeWindows";
import { getStatsCutoverUtcMs, mergeStatsCutoverIntoMin } from "@/lib/statsCutover";

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

export type ClosedTrophyLeaderboardResult = {
  periodStartMs: number;
  endMsExclusive: number;
  top3: Array<AggregatedLeader & { rank: number }>;
  error: Error | null;
};

/**
 * Same ranking window as trophy awards, without writing `user_trophies`.
 * Used by X digest cron and tests.
 */
export async function computeClosedTrophyLeaderboardTop3(
  supabase: SupabaseClient,
  timeframe: TrophyTimeframe,
  options?: { nowMs?: number; source?: string }
): Promise<ClosedTrophyLeaderboardResult> {
  const nowMs = options?.nowMs ?? Date.now();
  const source = options?.source ?? "user";
  const window = closedTrophyWindowUtcMs(timeframe, nowMs);
  if (!window) {
    return {
      periodStartMs: 0,
      endMsExclusive: 0,
      top3: [],
      error: new Error("Could not resolve trophy window"),
    };
  }
  const { periodStartMs, endMsExclusive } = window;

  const [{ rows, error: fetchErr }, cutoverMs, excludedDiscordIds] = await Promise.all([
    fetchCallPerformanceForSource(supabase, source),
    getStatsCutoverUtcMs(),
    fetchDiscordIdsExcludedFromLeaderboards(),
  ]);
  if (fetchErr) {
    return {
      periodStartMs,
      endMsExclusive,
      top3: [],
      error: fetchErr,
    };
  }

  const minMs = mergeStatsCutoverIntoMin(periodStartMs, cutoverMs);
  const filtered = filterRowsByCallTimeWindow(rows, minMs, endMsExclusive);
  const aggregated = aggregateCallPerformanceRows(filtered, excludedDiscordIds);
  const top3 = rankTopN(aggregated, 3);

  return { periodStartMs, endMsExclusive, top3, error: null };
}

/**
 * Inserts top-3 leaderboard trophies for the **last completed** UTC period
 * (calendar day / Monday week / calendar month). Uses the same `call_time`
 * buckets as the weekly-leader / monthly-leader / today-strip logic, with an
 * exclusive upper bound so a new period’s calls are not included.
 *
 * Intended to run from a secured cron shortly after each boundary (see
 * `/api/cron/award-leaderboard-trophies`).
 */
export async function awardTrophies(
  supabase: SupabaseClient,
  timeframe: TrophyTimeframe,
  options?: { nowMs?: number; source?: string }
): Promise<AwardTrophiesResult> {
  const computed = await computeClosedTrophyLeaderboardTop3(supabase, timeframe, options);
  if (computed.error) {
    return {
      periodStartMs: computed.periodStartMs,
      inserted: 0,
      leaders: [],
      error: computed.error,
    };
  }
  const { periodStartMs, top3 } = computed;

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
