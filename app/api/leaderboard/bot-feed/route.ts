import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  CP_BOT_FEED_LEGACY,
  CP_BOT_FEED_WITH_SNAPSHOT,
  selectCallPerformanceWithSnapshotFallback,
} from "@/lib/callPerformanceColumnFallback";
import {
  CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR,
  isCallPerformanceRowEligibleForStats,
} from "@/lib/callPerformanceDashboardVisibility";
import { rowAthMultiple } from "@/lib/callPerformanceMultiples";
import { rowCallTimeUtcMs } from "@/lib/callPerformanceLeaderboard";
import { abbreviateCa } from "@/lib/callDisplayFormat";
import { hasAccess } from "@/lib/hasAccess";
import { getStatsCutoverUtcMs, mergeStatsCutoverIntoMin } from "@/lib/statsCutover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
const LOOKBACK_MS = 90 * DAY_MS;
const LIVE_LIMIT = 20;
const MILESTONE_LIMIT = 20;
const MILESTONE_MIN_ATH = 2;

function rowSymbol(row: Record<string, unknown>): string {
  const tt = row.token_ticker;
  const tn = row.token_name;
  if (typeof tt === "string" && tt.trim()) return tt.trim().toUpperCase().slice(0, 14);
  if (typeof tn === "string" && tn.trim()) return tn.trim().slice(0, 14);
  const ca = typeof row.call_ca === "string" ? row.call_ca.trim() : "";
  return ca ? abbreviateCa(ca, 4, 4) : "—";
}

function milestoneTag(ath: number): "2x" | "3x" | "5x" | "10x" {
  if (ath >= 10) return "10x";
  if (ath >= 5) return "5x";
  if (ath >= 3) return "3x";
  return "2x";
}

function isEligibleStatsRow(r: Record<string, unknown>): boolean {
  return isCallPerformanceRowEligibleForStats(r);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await hasAccess(discordId, "view_bot_calls");
    if (!allowed) {
      return Response.json(
        {
          success: false,
          error: "Bot leaderboard extras require Pro/Elite.",
          code: "UPGRADE_REQUIRED",
        },
        { status: 403 }
      );
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY?.trim();
    if (!url || !key) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }

    const supabase = createClient(url, key);
    const now = Date.now();
    const cutoverMs = await getStatsCutoverUtcMs();
    const floor = mergeStatsCutoverIntoMin(now - LOOKBACK_MS, cutoverMs);

    const baseOpts = {
      columnsWithSnapshot: CP_BOT_FEED_WITH_SNAPSHOT,
      columnsLegacy: CP_BOT_FEED_LEGACY,
    };

    const [liveRes, mileRes] = await Promise.all([
      selectCallPerformanceWithSnapshotFallback({
        ...baseOpts,
        run: async (columns) => {
          const res = await supabase
            .from("call_performance")
            .select(columns)
            .eq("source", "bot")
            .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR)
            .gte("call_time", floor)
            .order("call_time", { ascending: false })
            .limit(LIVE_LIMIT);
          return { data: res.data, error: res.error, count: res.count };
        },
      }),
      selectCallPerformanceWithSnapshotFallback({
        ...baseOpts,
        run: async (columns) => {
          const res = await supabase
            .from("call_performance")
            .select(columns)
            .eq("source", "bot")
            .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR)
            .gte("call_time", floor)
            .gte("ath_multiple", MILESTONE_MIN_ATH)
            .order("call_time", { ascending: false })
            .limit(MILESTONE_LIMIT);
          return { data: res.data, error: res.error, count: res.count };
        },
      }),
    ]);

    if (liveRes.error || mileRes.error) {
      console.error("[leaderboard/bot-feed]", liveRes.error || mileRes.error);
      return Response.json({ success: false, error: "Failed to load bot feed" }, { status: 500 });
    }

    const rawLive = (Array.isArray(liveRes.data) ? liveRes.data : []) as Record<string, unknown>[];
    const rawMile = (Array.isArray(mileRes.data) ? mileRes.data : []) as Record<string, unknown>[];

    const liveRows = rawLive.filter(isEligibleStatsRow).map((r) => {
      const token = rowSymbol(r);
      const mcRaw = r.call_market_cap_usd;
      const mc = typeof mcRaw === "number" ? mcRaw : Number(mcRaw);
      const tMs = rowCallTimeUtcMs(r);
      const callTimeIso = tMs > 0 ? new Date(tMs).toISOString() : "";
      const caRaw = r.call_ca;
      const callCa = typeof caRaw === "string" ? caRaw.trim() : String(caRaw ?? "").trim();
      const imgRaw = r.token_image_url;
      const tokenImageUrl =
        typeof imgRaw === "string" && imgRaw.trim() ? imgRaw.trim().slice(0, 800) : null;
      return {
        token,
        callCa,
        tokenImageUrl,
        mc: Number.isFinite(mc) && mc > 0 ? mc : 0,
        callTimeIso,
      };
    });

    const milestoneRows = rawMile.filter(isEligibleStatsRow).map((r) => {
      const token = rowSymbol(r);
      const ath = rowAthMultiple(r);
      const tMs = rowCallTimeUtcMs(r);
      const callTimeIso = tMs > 0 ? new Date(tMs).toISOString() : "";
      const tag = milestoneTag(ath);
      const caRaw = r.call_ca;
      const callCa = typeof caRaw === "string" ? caRaw.trim() : String(caRaw ?? "").trim();
      const imgRaw = r.token_image_url;
      const tokenImageUrl =
        typeof imgRaw === "string" && imgRaw.trim() ? imgRaw.trim().slice(0, 800) : null;
      return {
        token,
        callCa,
        tokenImageUrl,
        milestone: tag,
        peakMultiple: ath,
        callTimeIso,
      };
    });

    return Response.json({
      success: true,
      live: liveRows,
      milestones: milestoneRows,
    });
  } catch (e) {
    console.error("[leaderboard/bot-feed] GET:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
