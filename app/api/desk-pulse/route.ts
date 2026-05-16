import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR } from "@/lib/callPerformanceDashboardVisibility";
import { minCallTimeMsForLeaderboardPeriod } from "@/lib/callPerformanceLeaderboard";
import { buildDeskPulseStats } from "@/lib/deskPulseStats";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getStatsCutoverUtcMs, mergeStatsCutoverIntoMin } from "@/lib/statsCutover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }

    const nowMs = Date.now();
    const cutoverMs = await getStatsCutoverUtcMs();
    const minMs = mergeStatsCutoverIntoMin(
      minCallTimeMsForLeaderboardPeriod("rolling24h", nowMs),
      cutoverMs
    );

    const { data, error } = await db
      .from("call_performance")
      .select(
        "id, username, discord_id, call_ca, ath_multiple, spot_multiple, call_time, source, excluded_from_stats, token_name, token_ticker, token_image_url"
      )
      .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR)
      .gte("call_time", minMs)
      .order("call_time", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("[desk-pulse] supabase:", error);
      return Response.json({ success: false, error: "Failed to load desk pulse" }, { status: 500 });
    }

    const raw = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const pulse = buildDeskPulseStats(raw, cutoverMs);

    return Response.json({
      success: true,
      pulse,
      updatedAt: new Date(nowMs).toISOString(),
    });
  } catch (e) {
    console.error("[desk-pulse] GET:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
