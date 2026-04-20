import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  aggregateCallPerformanceRows,
  fetchCallPerformanceForSource,
  filterRowsByMinCallTimeUtc,
} from "@/lib/callPerformanceLeaderboard";
import {
  bestXInLastMs,
  computeCallPerformanceUserStats,
  computeMedianX,
  countCallsInLastMs,
  countCallsInPriorRollingWindow,
  computeActiveDaysStreakUtc,
  hitRate2xInLastMs,
} from "@/lib/callPerformanceUserStats";
import { buildDailyCallBuckets, computeMultipleDistribution } from "@/lib/performanceSeries";
import { rollingSevenDaysStartUtcMs } from "@/lib/leaderboardTimeWindows";
import { filterCallRowsForStats, getStatsCutoverUtcMs, mergeStatsCutoverIntoMin } from "@/lib/statsCutover";

const DAY = 86_400_000;
const ROLLING_30D_MS = 30 * DAY;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.error("Missing Supabase env vars");
      return Response.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const supabase = createClient(url, key);
    const now = Date.now();

    const [{ data, error }, cutoverMs] = await Promise.all([
      supabase
        .from("call_performance")
        .select("ath_multiple, call_time, call_ca, excluded_from_stats")
        .eq("discord_id", discordId),
      getStatsCutoverUtcMs(),
    ]);

    if (error) {
      console.error("[me/performance-lab]", error);
      return Response.json({ error: "Failed to load performance" }, { status: 500 });
    }

    const rawRows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const rows = filterCallRowsForStats(rawRows, cutoverMs);

    const { avgX, winRate, totalCalls } = computeCallPerformanceUserStats(rows);
    const medianX = computeMedianX(rows);
    const callsToday = countCallsInLastMs(rows, DAY, now);
    const callsPriorRollingDay = countCallsInPriorRollingWindow(rows, DAY, now);
    const activeDaysStreak = computeActiveDaysStreakUtc(rows, now);
    const bestX30d = bestXInLastMs(rows, ROLLING_30D_MS, now);
    const hitRate2x30d = hitRate2xInLastMs(rows, ROLLING_30D_MS, now);

    const series14d = buildDailyCallBuckets(rows, 14, now);
    const distribution = computeMultipleDistribution(rows);

    const minRolling = mergeStatsCutoverIntoMin(rollingSevenDaysStartUtcMs(now), cutoverMs);
    const { rows: allUserRows, error: allErr } = await fetchCallPerformanceForSource(supabase, "user");
    if (allErr) {
      console.error("[me/performance-lab] rank fetch", allErr);
    }

    let rank7d: number | null = null;
    let totalRanked7d = 0;
    if (!allErr && allUserRows.length) {
      const filtered = filterRowsByMinCallTimeUtc(allUserRows, minRolling).filter(
        (r) => (r as any).excluded_from_stats !== true
      );
      const ranked = aggregateCallPerformanceRows(filtered);
      totalRanked7d = ranked.length;
      const idx = ranked.findIndex((r) => r.discordId === discordId);
      rank7d = idx === -1 ? null : idx + 1;
    }

    return Response.json({
      success: true,
      stats: {
        avgX,
        medianX,
        winRate,
        totalCalls,
        callsToday,
        callsPriorRollingDay,
        activeDaysStreak,
        bestX30d,
        hitRate2x30d,
      },
      series14d,
      distribution,
      rank7d,
      totalRanked7d,
    });
  } catch (e) {
    console.error("[me/performance-lab] GET:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
