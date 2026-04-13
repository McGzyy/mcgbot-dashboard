import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  computeCallPerformanceUserStats,
  countCallsInLastMs,
} from "@/lib/callPerformanceUserStats";

const ROLLING_DAY_MS = 86400000;

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

    const { data, error } = await supabase
      .from("call_performance")
      .select("ath_multiple, call_time")
      .eq("discord_id", discordId);

    if (error) {
      console.error("Supabase error:", error);
      return Response.json({ error: "Failed to load stats" }, { status: 500 });
    }

    const rows = (Array.isArray(data) ? data : []) as Record<
      string,
      unknown
    >[];

    const { avgX, winRate, totalCalls } =
      computeCallPerformanceUserStats(rows);
    const now = Date.now();
    const callsToday = countCallsInLastMs(rows, ROLLING_DAY_MS, now);

    return Response.json({
      avgX,
      winRate,
      callsToday,
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
