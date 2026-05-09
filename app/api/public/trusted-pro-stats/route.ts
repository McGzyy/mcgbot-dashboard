import { clampAthMultipleForStats } from "@/lib/callPerformanceMultiples";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = nums.reduce((a, b) => a + b, 0);
  return s / nums.length;
}

export async function GET() {
  try {
    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }

    const [tpUsersRes, callsRes] = await Promise.all([
      db.from("users").select("discord_id", { count: "exact", head: true }).eq("trusted_pro", true),
      db
        .from("trusted_pro_calls")
        .select("call_market_cap_usd, ath_multiple, time_to_ath_ms", { count: "exact" })
        .eq("status", "approved"),
    ]);

    if (tpUsersRes.error) {
      console.error("[public/trusted-pro-stats] users:", tpUsersRes.error);
      return Response.json({ success: false, error: "Failed to load stats" }, { status: 500 });
    }
    if (callsRes.error) {
      console.error("[public/trusted-pro-stats] calls:", callsRes.error);
      return Response.json({ success: false, error: "Failed to load stats" }, { status: 500 });
    }

    const tpCount = tpUsersRes.count ?? 0;
    const rows = Array.isArray(callsRes.data) ? (callsRes.data as any[]) : [];
    const totalCalls = callsRes.count ?? rows.length;

    const mcs: number[] = [];
    const aths: number[] = [];
    const times: number[] = [];
    let bestAth: number | null = null;

    for (const r of rows) {
      const mc = Number(r.call_market_cap_usd);
      if (Number.isFinite(mc) && mc > 0) mcs.push(mc);
      const ath = clampAthMultipleForStats(Number(r.ath_multiple));
      if (Number.isFinite(ath) && ath > 0) {
        aths.push(ath);
        if (bestAth == null || ath > bestAth) bestAth = ath;
      }
      const t = Number(r.time_to_ath_ms);
      if (Number.isFinite(t) && t > 0) times.push(t);
    }

    return Response.json({
      success: true,
      trustedPros: tpCount,
      totalCalls,
      avgCallMcUsd: avg(mcs),
      avgAthMultiple: avg(aths),
      avgTimeToAthMs: avg(times),
      bestAthMultipleAllTime: bestAth,
    });
  } catch (e) {
    console.error("[public/trusted-pro-stats] GET:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

