import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  aggregateCallPerformanceRows,
  fetchCallPerformanceForSource,
  filterRowsByMinCallTimeUtc,
  minCallTimeMsForLeaderboardPeriod,
  rankTopN,
} from "@/lib/callPerformanceLeaderboard";
import { hasAccess } from "@/lib/hasAccess";
import { getStatsCutoverUtcMs, mergeStatsCutoverIntoMin } from "@/lib/statsCutover";
import {
  displayNameForDiscordId,
  fetchDiscordDisplayNameMap,
} from "@/lib/leaderboardDisplayNames";

// WEEKLY LEADER = resets every Monday 00:00 UTC → GET /api/leaderboard/weekly-leader
// MONTHLY LEADER = resets first day of month 00:00 UTC → GET /api/leaderboard/monthly-leader
// RANKINGS = rolling window (last 7 days) UTC — this handler when `period` is omitted or `week`
// `period=today` = calls with call_time >= 00:00 UTC current calendar day (dashboard top performers)

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let type = searchParams.get("type") || "user";
    const period = searchParams.get("period");

    if (type === "bot") {
      const allowed = userId
        ? await hasAccess(userId, "view_bot_calls")
        : false;

      if (!allowed) {
        type = "user";
      }
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
      fetchCallPerformanceForSource(supabase, type),
      getStatsCutoverUtcMs(),
    ]);

    if (error) {
      console.error("Supabase error:", error);
      return Response.json(
        { error: "Failed to load leaderboard" },
        { status: 500 }
      );
    }

    const now = Date.now();
    const minCallTimeMs = mergeStatsCutoverIntoMin(
      minCallTimeMsForLeaderboardPeriod(period, now),
      cutoverMs
    );
    const filtered = filterRowsByMinCallTimeUtc(rows, minCallTimeMs);
    const eligible = filtered.filter(
      (r) =>
        (r as any).excluded_from_stats !== true &&
        (r as any).hidden_from_dashboard !== true
    );

    const aggregated = aggregateCallPerformanceRows(eligible);
    const ranked = rankTopN(aggregated, 10);
    const ids = ranked.map((r) => r.discordId);
    const nameMap = await fetchDiscordDisplayNameMap(supabase, ids);
    const enriched = ranked.map((r) => ({
      ...r,
      username: displayNameForDiscordId(r.discordId, r.username, nameMap),
    }));

    return Response.json(enriched);
  } catch (e) {
    console.error("[leaderboard API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
