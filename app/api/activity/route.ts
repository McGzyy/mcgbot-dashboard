import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserTier } from "@/lib/getUserTier";
import {
  formatNewCallActivityLine,
  formatWinActivityLine,
} from "@/lib/callDisplayFormat";
import {
  CP_ACTIVITY_LEGACY,
  CP_ACTIVITY_WITH_SNAPSHOT,
  selectCallPerformanceWithSnapshotFallback,
} from "@/lib/callPerformanceColumnFallback";
import { filterCallRowsForStats, getStatsCutoverUtcMs } from "@/lib/statsCutover";
import { rowLiveMultiple } from "@/lib/callPerformanceMultiples";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    const tier = await getUserTier(userId);

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

    const buildBaseQuery = (columns: string) => {
      let q = supabase.from("call_performance").select(columns);
      const t = tier.toLowerCase().trim();
      if (t === "free") {
        q = q.eq("source", "user");
      } else if (t === "pro") {
        q = q.in("source", ["user", "bot"]);
      }
      return q;
    };

    let followingIds: string[] | null = null;
    if (mode === "following") {
      if (!userId) {
        return Response.json([]);
      }

      const { data: follows, error: followError } = await supabase
        .from("follows")
        .select("following_discord_id")
        .eq("follower_discord_id", userId);

      if (followError) {
        console.error("[activity API] follows:", followError);
        return Response.json(
          { error: "Failed to load follows" },
          { status: 500 }
        );
      }

      const ids = (follows ?? [])
        .map((f) => {
          const row = f as { following_discord_id?: string | null };
          return row.following_discord_id;
        })
        .filter((id): id is string => typeof id === "string" && id.trim() !== "");

      if (ids.length === 0) {
        return Response.json([]);
      }
      followingIds = ids;
    }

    const [{ data, error }, cutoverMs] = await Promise.all([
      selectCallPerformanceWithSnapshotFallback({
        columnsWithSnapshot: CP_ACTIVITY_WITH_SNAPSHOT,
        columnsLegacy: CP_ACTIVITY_LEGACY,
        run: async (columns) => {
          let q = buildBaseQuery(columns);
          if (followingIds) {
            q = q.in("discord_id", followingIds);
          }
          const res = await q
            .order("call_time", { ascending: false })
            .limit(40);
          return { data: res.data, error: res.error };
        },
      }),
      getStatsCutoverUtcMs(),
    ]);

    if (error) {
      console.error("Supabase error:", error);
      return Response.json(
        { error: "Failed to load activity" },
        { status: 500 }
      );
    }

    const rawRows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const rows = filterCallRowsForStats(rawRows, cutoverMs).slice(0, 20);

    const events = rows.map((row) => {
      const r = row as Record<string, unknown>;
      const multiple = rowLiveMultiple(r);
      const username =
        typeof r.username === "string" && r.username.trim() !== ""
          ? r.username.trim()
          : "Unknown";

      const discordRaw = r.discord_id;
      const discordId =
        typeof discordRaw === "string" && discordRaw.trim() !== ""
          ? discordRaw.trim()
          : "";

      const rawCa =
        r.call_ca != null && String(r.call_ca).trim() !== ""
          ? String(r.call_ca).trim()
          : null;

      const link_chart = rawCa
        ? `https://dexscreener.com/solana/${rawCa}`
        : null;

      const link_post =
        typeof r.message_url === "string" && r.message_url.trim() !== ""
          ? r.message_url.trim()
          : null;

      const tn =
        typeof r.token_name === "string" && r.token_name.trim() !== ""
          ? r.token_name.trim()
          : null;
      const tt =
        typeof r.token_ticker === "string" && r.token_ticker.trim() !== ""
          ? r.token_ticker.trim()
          : null;
      const mcNum = Number(r.call_market_cap_usd);
      const imgRaw = r.token_image_url;
      const tokenImageUrl =
        typeof imgRaw === "string" && imgRaw.trim() !== ""
          ? imgRaw.trim().slice(0, 800)
          : null;

      const meta = {
        tokenName: tn,
        tokenTicker: tt,
        callMarketCapUsd:
          Number.isFinite(mcNum) && mcNum > 0 ? mcNum : null,
        callCa: rawCa,
      };

      if (multiple >= 2) {
        return {
          type: "win" as const,
          text: formatWinActivityLine(username, multiple, meta),
          username,
          time: r.call_time,
          link_chart,
          link_post,
          multiple,
          discordId,
          tokenImageUrl,
        };
      }

      return {
        type: "call" as const,
        text: formatNewCallActivityLine(username, meta),
        username,
        time: r.call_time,
        link_chart,
        link_post,
        multiple,
        discordId,
        tokenImageUrl,
      };
    });

    return Response.json(events);
  } catch (e) {
    console.error("[activity API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
