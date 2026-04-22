import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  minCallTimeMsForLeaderboardPeriod,
  rowCallTimeUtcMs,
} from "@/lib/callPerformanceLeaderboard";
import {
  CP_TOP_CALLS_LEGACY,
  CP_TOP_CALLS_WITH_SNAPSHOT,
  selectCallPerformanceWithSnapshotFallback,
} from "@/lib/callPerformanceColumnFallback";
import { rowAthMultiple } from "@/lib/callPerformanceMultiples";
import { abbreviateCa } from "@/lib/callDisplayFormat";
import {
  displayNameForDiscordId,
  fetchDiscordDisplayNameMap,
} from "@/lib/leaderboardDisplayNames";
import { hasAccess } from "@/lib/hasAccess";
import { getStatsCutoverUtcMs, mergeStatsCutoverIntoMin } from "@/lib/statsCutover";

function rowSymbol(row: Record<string, unknown>): string {
  const tt = row.token_ticker;
  const tn = row.token_name;
  if (typeof tt === "string" && tt.trim()) return tt.trim().toUpperCase().slice(0, 14);
  if (typeof tn === "string" && tn.trim()) return tn.trim().slice(0, 14);
  const ca = typeof row.call_ca === "string" ? row.call_ca.trim() : "";
  return ca ? abbreviateCa(ca, 4, 4) : "—";
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let type = searchParams.get("type") || "user";
    if (type === "bot") {
      const allowed = await hasAccess(session.user.id, "view_bot_calls");
      if (!allowed) type = "user";
    }

    const period = searchParams.get("period");
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

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
    const now = Date.now();
    const cutoverMs = await getStatsCutoverUtcMs();
    const minMs = mergeStatsCutoverIntoMin(
      minCallTimeMsForLeaderboardPeriod(period, now),
      cutoverMs
    );

    const { data, error, count } = await selectCallPerformanceWithSnapshotFallback({
      columnsWithSnapshot: CP_TOP_CALLS_WITH_SNAPSHOT,
      columnsLegacy: CP_TOP_CALLS_LEGACY,
      run: async (columns) => {
        let q = supabase
          .from("call_performance")
          .select(columns, { count: "exact" })
          .eq("source", type)
          .gt("ath_multiple", 0);

        if (minMs > 0) {
          q = q.gte("call_time", minMs);
        }

        q = q
          .or("excluded_from_stats.is.null,excluded_from_stats.eq.false")
          .order("ath_multiple", { ascending: false })
          .order("call_time", { ascending: false })
          .range(offset, offset + limit - 1);

        const res = await q;
        return { data: res.data, error: res.error, count: res.count };
      },
    });

    if (error) {
      console.error("[leaderboard/top-calls] Supabase:", error);
      return Response.json(
        { error: "Failed to load top calls" },
        { status: 500 }
      );
    }

    const raw = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const eligible = raw.filter((r) => (r as { excluded_from_stats?: boolean }).excluded_from_stats !== true);
    const discordIds = eligible
      .map((r) => (typeof r.discord_id === "string" ? r.discord_id.trim() : String(r.discord_id ?? "").trim()))
      .filter(Boolean);
    const nameMap = await fetchDiscordDisplayNameMap(supabase, discordIds);

    const rows = eligible.map((r) => {
      const discordId =
        typeof r.discord_id === "string"
          ? r.discord_id.trim()
          : String(r.discord_id ?? "").trim();
      const rawUser =
        typeof r.username === "string" ? r.username.trim() : String(r.username ?? "").trim();
      const username = displayNameForDiscordId(discordId, rawUser, nameMap);
      const tMs = rowCallTimeUtcMs(r);
      const callTimeIso = tMs > 0 ? new Date(tMs).toISOString() : "";
      const imgRaw = r.token_image_url;
      const tokenImageUrl =
        typeof imgRaw === "string" && imgRaw.trim()
          ? imgRaw.trim().slice(0, 800)
          : null;

      const callCa = typeof r.call_ca === "string" ? r.call_ca.trim() : String(r.call_ca ?? "").trim();

      return {
        id: r.id != null ? String(r.id) : "",
        symbol: rowSymbol(r),
        callCa,
        tokenImageUrl,
        multiplier: rowAthMultiple(r),
        username,
        discordId: discordId || undefined,
        callTimeIso,
        callToAth: "—",
      };
    });

    return Response.json({
      rows,
      total: typeof count === "number" ? count : rows.length,
      offset,
      limit,
    });
  } catch (e) {
    console.error("[leaderboard/top-calls] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
