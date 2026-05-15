import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  aggregateCallPerformanceRows,
  fetchCallPerformanceForSource,
  filterRowsByMinCallTimeUtc,
  minCallTimeMsForLeaderboardPeriod,
} from "@/lib/callPerformanceLeaderboard";
import { getStatsCutoverUtcMs, mergeStatsCutoverIntoMin } from "@/lib/statsCutover";
import { isCallPerformanceRowEligibleForStats } from "@/lib/callPerformanceDashboardVisibility";
import { fetchDiscordIdsExcludedFromLeaderboards } from "@/lib/guildMembershipSync";

const PERIODS = ["today", "week", "30d", "all"] as const;

export type MeLeaderboardRankPeriod = (typeof PERIODS)[number];

export type MeLeaderboardRankEntry = {
  rank: number | null;
  totalRanked: number;
};

/**
 * Caller ranks for the same UTC windows as `GET /api/leaderboard` (today / rolling week /
 * rolling 30d / all-time), in one round trip.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const selfId = session?.user?.id?.trim() ?? "";
    if (!selfId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      console.error("Missing Supabase env vars");
      return Response.json(
        { error: "Supabase not configured" },
        { status: 500 },
      );
    }

    const supabase = createClient(url, key);

    const [{ rows, error }, cutoverMs, excludedDiscordIds] = await Promise.all([
      fetchCallPerformanceForSource(supabase, "user"),
      getStatsCutoverUtcMs(),
      fetchDiscordIdsExcludedFromLeaderboards(),
    ]);

    if (error) {
      console.error("[me/leaderboard-rank] GET:", error);
      return Response.json({ error: "Failed to load rank" }, { status: 500 });
    }

    const now = Date.now();
    const byPeriod: Record<MeLeaderboardRankPeriod, MeLeaderboardRankEntry> = {
      today: { rank: null, totalRanked: 0 },
      week: { rank: null, totalRanked: 0 },
      "30d": { rank: null, totalRanked: 0 },
      all: { rank: null, totalRanked: 0 },
    };

    for (const period of PERIODS) {
      const minCallTimeMs = mergeStatsCutoverIntoMin(
        minCallTimeMsForLeaderboardPeriod(period, now),
        cutoverMs,
      );
      const filtered = filterRowsByMinCallTimeUtc(
        rows as Record<string, unknown>[],
        minCallTimeMs,
      );
      const eligible = filtered.filter((r) =>
        isCallPerformanceRowEligibleForStats(r as Record<string, unknown>),
      );
      const results = aggregateCallPerformanceRows(eligible, excludedDiscordIds);
      const idx = results.findIndex((r) => r.discordId === selfId);
      byPeriod[period] = {
        rank: idx === -1 ? null : idx + 1,
        totalRanked: results.length,
      };
    }

    return Response.json({
      success: true,
      byPeriod,
      /** @deprecated Prefer `byPeriod.all` — kept for older clients */
      rank: byPeriod.all.rank,
      totalRanked: byPeriod.all.totalRanked,
    });
  } catch (e) {
    console.error("[me/leaderboard-rank API] GET:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
