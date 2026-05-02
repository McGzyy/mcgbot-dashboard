import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  computeCallPerformanceUserStats,
  computeMedianX,
  bestXInLastMs,
  hitRate2xInLastMs,
  countCallsInLastMs,
  countCallsInPriorRollingWindow,
  computeActiveDaysStreakUtc,
} from "@/lib/callPerformanceUserStats";
import {
  CALL_PERFORMANCE_NOT_EXCLUDED_FROM_STATS_OR,
  CALL_PERFORMANCE_VISIBLE_ON_DASHBOARD_OR,
} from "@/lib/callPerformanceDashboardVisibility";
import { filterCallRowsForStats, getStatsCutoverUtcMs } from "@/lib/statsCutover";

const ROLLING_DAY_MS = 86400000;
const ROLLING_30D_MS = 30 * 86400000;

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
      return Response.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key);

    const [{ data, error }, cutoverMs] = await Promise.all([
      supabase
        .from("call_performance")
        .select("ath_multiple, spot_multiple, call_time, excluded_from_stats")
        .eq("discord_id", discordId)
        .or(CALL_PERFORMANCE_VISIBLE_ON_DASHBOARD_OR)
        .or(CALL_PERFORMANCE_NOT_EXCLUDED_FROM_STATS_OR),
      getStatsCutoverUtcMs(),
    ]);

    if (error) {
      console.error("Supabase error:", error);
      return Response.json({ error: "Failed to load stats" }, { status: 500 });
    }

    const rawRows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const rows = filterCallRowsForStats(rawRows, cutoverMs);

    const { avgX, winRate, totalCalls } = computeCallPerformanceUserStats(rows);
    const medianX = computeMedianX(rows);
    const now = Date.now();
    const callsToday = countCallsInLastMs(rows, ROLLING_DAY_MS, now);
    const callsPriorRollingDay = countCallsInPriorRollingWindow(
      rows,
      ROLLING_DAY_MS,
      now,
    );
    const activeDaysStreak = computeActiveDaysStreakUtc(rows, now);
    const bestX30d = bestXInLastMs(rows, ROLLING_30D_MS, now);
    const hitRate2x30d = hitRate2xInLastMs(rows, ROLLING_30D_MS, now);

    return Response.json({
      avgX,
      medianX,
      winRate,
      callsToday,
      callsPriorRollingDay,
      activeDaysStreak,
      bestX30d,
      hitRate2x30d,
      totalCalls,
    });
  } catch (e) {
    console.error("[me/stats API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
