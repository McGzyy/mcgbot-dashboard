import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  CP_TAPE_LEGACY,
  CP_TAPE_WITH_SNAPSHOT,
  selectCallPerformanceWithSnapshotFallback,
} from "@/lib/callPerformanceColumnFallback";
import { mergeStatsCutoverIntoMin, getStatsCutoverUtcMs } from "@/lib/statsCutover";

const DAY = 86_400_000;

function windowStartMs(window: string | null, now: number): number {
  if (window === "all") return 0;
  if (window === "30d") return now - 30 * DAY;
  return now - 7 * DAY;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const window = searchParams.get("window") ?? "30d";
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 40));
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

    const url = process.env.SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      process.env.SUPABASE_ANON_KEY?.trim();
    if (!url || !key) {
      console.error("Missing Supabase env vars");
      return Response.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const supabase = createClient(url, key);
    const now = Date.now();
    const cutoverMs = await getStatsCutoverUtcMs();
    const winStart = windowStartMs(window, now);
    const floor = mergeStatsCutoverIntoMin(winStart, cutoverMs);

    const { data, error, count } = await selectCallPerformanceWithSnapshotFallback({
      columnsWithSnapshot: CP_TAPE_WITH_SNAPSHOT,
      columnsLegacy: CP_TAPE_LEGACY,
      run: async (columns) => {
        const res = await supabase
          .from("call_performance")
          .select(columns, { count: "exact" })
          .eq("discord_id", discordId)
          .gte("call_time", floor)
          .order("call_time", { ascending: false })
          .range(offset, offset + limit - 1);
        return { data: res.data, error: res.error, count: res.count };
      },
    });

    if (error) {
      console.error("[me/call-tape]", error);
      return Response.json({ error: "Failed to load calls" }, { status: 500 });
    }

    const rawRows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const rows = rawRows.map((r) => {
      const mcRaw = r.call_market_cap_usd;
      const mcNum = typeof mcRaw === "number" ? mcRaw : Number(mcRaw);
      const tn = r.token_name;
      const tt = r.token_ticker;
      const imgRaw = r.token_image_url;
      const tokenImageUrl =
        typeof imgRaw === "string" && imgRaw.trim() ? imgRaw.trim().slice(0, 800) : null;
      return {
        id: r.id != null ? String(r.id) : "",
        callCa: typeof r.call_ca === "string" ? r.call_ca.trim() : String(r.call_ca ?? ""),
        athMultiple: Number(r.ath_multiple ?? 0),
        callTime: r.call_time,
        source: typeof r.source === "string" ? r.source : "user",
        messageUrl: typeof r.message_url === "string" ? r.message_url.trim() : null,
        username: typeof r.username === "string" ? r.username.trim() : "",
        excludedFromStats: r.excluded_from_stats === true,
        tokenName: typeof tn === "string" && tn.trim() ? tn.trim() : null,
        tokenTicker: typeof tt === "string" && tt.trim() ? tt.trim() : null,
        callMarketCapUsd:
          Number.isFinite(mcNum) && mcNum > 0 ? mcNum : null,
        tokenImageUrl,
      };
    });

    return Response.json({
      success: true,
      window,
      rows,
      total: typeof count === "number" ? count : rows.length,
      offset,
      limit,
    });
  } catch (e) {
    console.error("[me/call-tape] GET:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
