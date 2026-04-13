import { createClient } from "@supabase/supabase-js";
import {
  computeCallPerformanceUserStats,
  pickLatestUsername,
  recentCallsFromRows,
} from "@/lib/callPerformanceUserStats";

const PROFILE_RECENT_CALLS_LIMIT = 15;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await context.params;
    const discordId = decodeURIComponent(String(rawId ?? "")).trim();
    if (!discordId || discordId.length > 64) {
      return Response.json({ error: "Invalid user id" }, { status: 400 });
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

    const [{ data, error }, userRowResult] = await Promise.all([
      supabase
        .from("call_performance")
        .select("username, call_ca, ath_multiple, call_time")
        .eq("discord_id", discordId),
      supabase
        .from("users")
        .select("id, discord_id, bio, banner_url, x_handle, x_verified, created_at")
        .eq("discord_id", discordId)
        .maybeSingle(),
    ]);

    if (error) {
      console.error("[user API] GET:", error);
      return Response.json(
        { error: "Failed to load profile" },
        { status: 500 }
      );
    }

    if (userRowResult.error) {
      console.error("[user API] GET users row:", userRowResult.error);
    }

    const userRow = userRowResult.data as
      | {
          id?: unknown;
          discord_id?: unknown;
          bio?: unknown;
          banner_url?: unknown;
          x_handle?: unknown;
          x_verified?: unknown;
          created_at?: unknown;
        }
      | null;
    
    console.log("USER FETCH RESULT:", userRowResult.data, userRowResult.error);

    const rows = (Array.isArray(data) ? data : []) as Record<
      string,
      unknown
    >[];

    const username = pickLatestUsername(rows, discordId);
    const stats = computeCallPerformanceUserStats(rows);
    const recentCalls = recentCallsFromRows(rows, PROFILE_RECENT_CALLS_LIMIT);

    return Response.json({
      username,
      // Badges are now fetched from `user_badges` on the client; keep fields for compatibility.
      isTopCaller: false,
      isTrustedPro: false,
      bio:
        userRow?.bio == null
          ? null
          : typeof userRow.bio === "string"
            ? userRow.bio
            : String(userRow.bio),
      banner_url:
        userRow?.banner_url == null
          ? null
          : typeof userRow.banner_url === "string"
            ? userRow.banner_url
            : String(userRow.banner_url),
      x_handle:
        userRow?.x_handle == null
          ? null
          : typeof userRow.x_handle === "string"
            ? userRow.x_handle
            : String(userRow.x_handle),
      x_verified: Boolean(userRow?.x_verified),
      stats: {
        avgX: stats.avgX,
        winRate: stats.winRate,
        totalCalls: stats.totalCalls,
      },
      recentCalls,
    });
  } catch (e) {
    console.error("[user API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
