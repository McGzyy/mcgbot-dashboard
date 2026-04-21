import type { SupabaseClient } from "@supabase/supabase-js";
import {
  rollingSevenDaysStartUtcMs,
  startOfCalendarDayUtcMs,
} from "@/lib/leaderboardTimeWindows";

export type AggregatedLeader = {
  discordId: string;
  username: string;
  avgX: number;
  totalCalls: number;
  wins: number;
  bestMultiple: number;
};

type Agg = {
  discord_id: string;
  username: string;
  totalCalls: number;
  sumX: number;
  wins: number;
  maxMultiple: number;
};

/** Normalize `call_time` to UTC epoch ms (number, numeric string, or ISO from Postgres). */
export function rowCallTimeUtcMs(row: Record<string, unknown>): number {
  const t = row.call_time;
  if (typeof t === "number" && Number.isFinite(t)) return t;
  if (typeof t === "string") {
    const parsed = Date.parse(t);
    if (Number.isFinite(parsed)) return parsed;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

export function filterRowsByMinCallTimeUtc(
  rows: Record<string, unknown>[],
  minCallTimeMs: number
): Record<string, unknown>[] {
  return rows.filter((row) => {
    const t = rowCallTimeUtcMs(row);
    return t > 0 && t >= minCallTimeMs;
  });
}

/** `call_time` in `[minCallTimeMs, endMsExclusive)` (UTC epoch ms). */
export function filterRowsByCallTimeWindow(
  rows: Record<string, unknown>[],
  minCallTimeMs: number,
  endMsExclusive: number
): Record<string, unknown>[] {
  return rows.filter((row) => {
    const t = rowCallTimeUtcMs(row);
    return (
      t > 0 &&
      t >= minCallTimeMs &&
      t < endMsExclusive &&
      Number.isFinite(endMsExclusive)
    );
  });
}

export function aggregateCallPerformanceRows(
  rows: Record<string, unknown>[]
): AggregatedLeader[] {
  const sorted = [...rows].sort(
    (a, b) => rowCallTimeUtcMs(a) - rowCallTimeUtcMs(b)
  );

  const map = new Map<string, Agg>();

  for (const row of sorted) {
    if ((row as any).excluded_from_stats === true) continue;
    const discordId =
      typeof row.discord_id === "string"
        ? row.discord_id.trim()
        : String(row.discord_id ?? "").trim();
    if (!discordId) continue;

    const mult =
      typeof row.ath_multiple === "number" &&
      Number.isFinite(row.ath_multiple)
        ? row.ath_multiple
        : Number(row.ath_multiple);
    if (!Number.isFinite(mult)) continue;

    let user = map.get(discordId);
    if (!user) {
      user = {
        discord_id: discordId,
        username: "",
        totalCalls: 0,
        sumX: 0,
        wins: 0,
        maxMultiple: mult,
      };
      map.set(discordId, user);
    }

    user.totalCalls += 1;
    user.sumX += mult;
    if (mult >= 2) user.wins += 1;
    if (mult > user.maxMultiple) user.maxMultiple = mult;
    user.username =
      typeof row.username === "string" ? row.username.trim() : "";
  }

  const results: AggregatedLeader[] = Array.from(map.values()).map((user) => ({
    discordId: user.discord_id,
    username: user.username || user.discord_id,
    avgX: user.sumX / user.totalCalls,
    totalCalls: user.totalCalls,
    wins: user.wins,
    bestMultiple: user.maxMultiple,
  }));

  results.sort((a, b) => b.avgX - a.avgX);
  return results;
}

export function rankTopN(
  aggregated: AggregatedLeader[],
  n: number
): Array<AggregatedLeader & { rank: number }> {
  return aggregated.slice(0, n).map((u, i) => ({
    ...u,
    rank: i + 1,
  }));
}

/** Minimum `call_time` for /api/leaderboard GET (rankings vs today strip). */
export function minCallTimeMsForLeaderboardPeriod(
  period: string | null,
  nowMs: number
): number {
  if (period === "today") {
    return startOfCalendarDayUtcMs(nowMs);
  }
  // `week` previously meant rolling 7d; align with default rankings window.
  if (period === "week" || period == null || period === "") {
    return rollingSevenDaysStartUtcMs(nowMs);
  }
  // Prepare for 30d / all-time: explicit tokens only
  if (period === "30d") {
    return nowMs - 30 * 24 * 60 * 60 * 1000;
  }
  if (period === "all") {
    return 0;
  }
  return rollingSevenDaysStartUtcMs(nowMs);
}

export async function fetchCallPerformanceForSource(
  supabase: SupabaseClient,
  source: string
): Promise<{ rows: Record<string, unknown>[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("call_performance")
    .select("*")
    .eq("source", source);

  if (error) {
    return { rows: [], error: new Error(error.message) };
  }
  const rows = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : [];
  return { rows, error: null };
}

/** #1 by avgX after filtering to `call_time >= minCallTimeMs` (UTC). */
export async function getTopLeaderSince(
  supabase: SupabaseClient,
  source: string,
  minCallTimeMs: number
): Promise<AggregatedLeader | null> {
  const { rows, error } = await fetchCallPerformanceForSource(supabase, source);
  if (error) throw error;
  const filtered = filterRowsByMinCallTimeUtc(rows, minCallTimeMs);
  const agg = aggregateCallPerformanceRows(filtered);
  return agg[0] ?? null;
}
