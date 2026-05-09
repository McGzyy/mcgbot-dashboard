import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  CP_RECENT_LEGACY,
  CP_RECENT_WITH_SNAPSHOT,
  selectCallPerformanceWithSnapshotFallback,
} from "@/lib/callPerformanceColumnFallback";
import { CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR } from "@/lib/callPerformanceDashboardVisibility";
import { mapCallPerformanceRowToRecentCall } from "@/lib/callPerformanceUserStats";
import { filterCallRowsForStats, getStatsCutoverUtcMs } from "@/lib/statsCutover";

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
      selectCallPerformanceWithSnapshotFallback({
        columnsWithSnapshot: CP_RECENT_WITH_SNAPSHOT,
        columnsLegacy: CP_RECENT_LEGACY,
        run: async (columns) => {
          const res = await supabase
            .from("call_performance")
            .select(columns)
            .eq("discord_id", discordId)
            .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR)
            .order("call_time", { ascending: false })
            .limit(50);
          return { data: res.data, error: res.error };
        },
      }),
      getStatsCutoverUtcMs(),
    ]);

    if (error) {
      console.error("Supabase error:", error);
      return Response.json(
        { error: "Failed to load recent calls" },
        { status: 500 }
      );
    }

    const rawRows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const rows = filterCallRowsForStats(rawRows, cutoverMs).slice(0, 10);

    return Response.json(rows.map(mapCallPerformanceRowToRecentCall));
  } catch (e) {
    console.error("[me/recent-calls API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
