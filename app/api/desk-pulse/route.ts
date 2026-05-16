import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR } from "@/lib/callPerformanceDashboardVisibility";
import {
  filterRowsByCallTimeWindow,
  minCallTimeMsForLeaderboardPeriod,
} from "@/lib/callPerformanceLeaderboard";
import { buildDeskPulseStats } from "@/lib/deskPulseStats";
import { buildDeskRecentHits } from "@/lib/deskRecentHits";
import { buildDeskRankMovers } from "@/lib/deskRankMovers";
import { buildDeskYouStats } from "@/lib/deskYouStats";
import { fetchDiscordIdsExcludedFromLeaderboards } from "@/lib/guildMembershipSync";
import {
  displayNameForDiscordId,
  fetchDiscordDisplayNameMap,
} from "@/lib/leaderboardDisplayNames";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { filterCallRowsForStats, getStatsCutoverUtcMs, mergeStatsCutoverIntoMin } from "@/lib/statsCutover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const viewerId = session?.user?.id?.trim() ?? "";
    if (!viewerId) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }

    const nowMs = Date.now();
    const [cutoverMs, excludedDiscordIds] = await Promise.all([
      getStatsCutoverUtcMs(),
      fetchDiscordIdsExcludedFromLeaderboards(),
    ]);
    const currentMinMs = mergeStatsCutoverIntoMin(
      minCallTimeMsForLeaderboardPeriod("rolling24h", nowMs),
      cutoverMs
    );
    const fetchMinMs = mergeStatsCutoverIntoMin(currentMinMs - DAY_MS, cutoverMs);

    const { data, error } = await db
      .from("call_performance")
      .select(
        "id, username, discord_id, call_ca, ath_multiple, spot_multiple, call_time, source, excluded_from_stats, token_name, token_ticker, token_image_url"
      )
      .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR)
      .gte("call_time", fetchMinMs)
      .order("call_time", { ascending: false })
      .limit(8000);

    if (error) {
      console.error("[desk-pulse] supabase:", error);
      return Response.json({ success: false, error: "Failed to load desk pulse" }, { status: 500 });
    }

    const raw = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const eligible = filterCallRowsForStats(raw, cutoverMs);
    const windowRows = filterRowsByCallTimeWindow(eligible, currentMinMs, nowMs);

    const pulse = buildDeskPulseStats(windowRows, cutoverMs);
    const recentHits = buildDeskRecentHits(windowRows, cutoverMs, 6);
    const you = buildDeskYouStats(
      eligible,
      cutoverMs,
      viewerId,
      currentMinMs,
      nowMs,
      excludedDiscordIds
    );
    const moversRaw = buildDeskRankMovers(
      eligible,
      cutoverMs,
      currentMinMs,
      nowMs,
      5,
      excludedDiscordIds
    );

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    let rankMovers = moversRaw;
    if (url && key && moversRaw.length > 0) {
      const supabase = createClient(url, key);
      const ids = moversRaw.map((m) => m.discordId).filter(Boolean);
      const nameMap = await fetchDiscordDisplayNameMap(supabase, ids);
      rankMovers = moversRaw.map((m) => ({
        ...m,
        username: displayNameForDiscordId(m.discordId, m.username, nameMap),
      }));
    }

    return Response.json({
      success: true,
      pulse,
      you,
      rankMovers,
      recentHits,
      updatedAt: new Date(nowMs).toISOString(),
    });
  } catch (e) {
    console.error("[desk-pulse] GET:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
