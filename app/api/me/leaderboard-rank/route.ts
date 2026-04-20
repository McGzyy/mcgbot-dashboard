import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  aggregateCallPerformanceRows,
  fetchCallPerformanceForSource,
  filterRowsByMinCallTimeUtc,
} from "@/lib/callPerformanceLeaderboard";
import { rollingSevenDaysStartUtcMs } from "@/lib/leaderboardTimeWindows";
import { getStatsCutoverUtcMs, mergeStatsCutoverIntoMin } from "@/lib/statsCutover";

// RANKINGS = rolling window (last 7 days), UTC — same window as default /api/leaderboard rankings

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
        { status: 500 }
      );
    }

    const supabase = createClient(url, key);

    const [{ rows, error }, cutoverMs] = await Promise.all([
      fetchCallPerformanceForSource(supabase, "user"),
      getStatsCutoverUtcMs(),
    ]);

    if (error) {
      console.error("[me/leaderboard-rank] GET:", error);
      return Response.json(
        { error: "Failed to load rank" },
        { status: 500 }
      );
    }

    const now = Date.now();
    const minCallTimeMs = mergeStatsCutoverIntoMin(rollingSevenDaysStartUtcMs(now), cutoverMs);
    const filtered = filterRowsByMinCallTimeUtc(rows, minCallTimeMs);

    const results = aggregateCallPerformanceRows(filtered);

    const idx = results.findIndex((r) => r.discordId === selfId);
    const rank = idx === -1 ? null : idx + 1;

    return Response.json({
      rank,
      totalRanked: results.length,
    });
  } catch (e) {
    console.error("[me/leaderboard-rank API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
