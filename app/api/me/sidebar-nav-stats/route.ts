import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR } from "@/lib/callPerformanceDashboardVisibility";
import { rolling24HoursStartUtcMs } from "@/lib/leaderboardTimeWindows";
import { requireProFeaturesForSession } from "@/lib/subscription/productTierAccess";
import { isOutsideCallsEnabled } from "@/lib/outsideCallsSettings";
import {
  avgAthFromCallPerformanceRows,
  avgAthFromOutsideCallRows,
  avgAthFromTrustedProRows,
} from "@/lib/sidebarNavFeedStats";
import { getStatsCutoverUtcMs, mergeStatsCutoverIntoMin } from "@/lib/statsCutover";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }

    const nowMs = Date.now();
    const [cutoverMs, proGate, outsideEnabled] = await Promise.all([
      getStatsCutoverUtcMs(),
      requireProFeaturesForSession(session),
      isOutsideCallsEnabled(),
    ]);
    const minMs = mergeStatsCutoverIntoMin(rolling24HoursStartUtcMs(nowMs), cutoverMs);
    const minIso = new Date(minMs).toISOString();

    const cpSelect = "ath_multiple, spot_multiple, call_time, source, excluded_from_stats";

    const [botRes, mineRes, tpRes, outRes] = await Promise.all([
      db
        .from("call_performance")
        .select(cpSelect)
        .eq("source", "bot")
        .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR)
        .gte("call_time", minMs)
        .limit(5000),
      db
        .from("call_performance")
        .select(cpSelect)
        .eq("discord_id", discordId)
        .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR)
        .gte("call_time", minMs)
        .limit(5000),
      db
        .from("trusted_pro_calls")
        .select("ath_multiple, published_at, created_at")
        .eq("status", "approved")
        .gte("created_at", minIso)
        .limit(2000),
      proGate.ok && outsideEnabled
        ? db
            .from("outside_calls")
            .select(
              `
              trust_max_ath_multiple,
              posted_at,
              outside_x_sources (
                status
              )
            `
            )
            .gte("posted_at", minIso)
            .limit(2000)
        : Promise.resolve({ data: [] as unknown[], error: null }),
    ]);

    if (botRes.error || mineRes.error || tpRes.error || outRes.error) {
      console.error("[me/sidebar-nav-stats]", botRes.error || mineRes.error || tpRes.error || outRes.error);
      return Response.json({ success: false, error: "Failed to load nav stats" }, { status: 500 });
    }

    const botRows = (Array.isArray(botRes.data) ? botRes.data : []) as Record<string, unknown>[];
    const mineRows = (Array.isArray(mineRes.data) ? mineRes.data : []) as Record<string, unknown>[];
    const tpRows = (Array.isArray(tpRes.data) ? tpRes.data : []) as Record<string, unknown>[];
    const outRows = (Array.isArray(outRes.data) ? outRes.data : []) as Record<string, unknown>[];

    return Response.json({
      success: true,
      window: "rolling24h" as const,
      botCalls: avgAthFromCallPerformanceRows(botRows, cutoverMs, minMs, nowMs),
      trustedPro: avgAthFromTrustedProRows(tpRows, minMs, nowMs),
      outsideCalls: proGate.ok && outsideEnabled ? avgAthFromOutsideCallRows(outRows, minMs, nowMs) : null,
      myCallLog: avgAthFromCallPerformanceRows(mineRows, cutoverMs, minMs, nowMs),
    });
  } catch (e) {
    console.error("[me/sidebar-nav-stats] GET:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
