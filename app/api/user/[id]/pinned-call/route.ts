import {
  CALL_PERFORMANCE_NOT_EXCLUDED_FROM_STATS_OR,
  CALL_PERFORMANCE_VISIBLE_ON_DASHBOARD_OR,
} from "@/lib/callPerformanceDashboardVisibility";
import {
  looksLikeDiscordSnowflake,
  resolveDiscordIdFromProfileRouteParam,
} from "@/lib/discordIdentity";
import { rowAthMultiple } from "@/lib/callPerformanceMultiples";
import { isPublicProfileHiddenFromViewer } from "@/lib/profileGuildVisibility";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await context.params;
    const routeParam = decodeURIComponent(String(rawId ?? "")).trim();
    if (!routeParam || routeParam.length > 200) {
      return Response.json({ error: "Invalid user id" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const discordId = looksLikeDiscordSnowflake(routeParam)
      ? routeParam.trim()
      : await resolveDiscordIdFromProfileRouteParam(db, routeParam);

    if (!discordId) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (await isPublicProfileHiddenFromViewer(discordId)) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const { data: user, error: userErr } = await db
      .from("users")
      .select("pinned_call_id")
      .eq("discord_id", discordId)
      .maybeSingle();

    if (userErr) {
      return Response.json({ error: userErr.message }, { status: 500 });
    }

    const pinnedIdRaw = (user as { pinned_call_id?: unknown })?.pinned_call_id;
    const pinnedCallId =
      typeof pinnedIdRaw === "string"
        ? pinnedIdRaw.trim()
        : pinnedIdRaw == null
          ? ""
          : String(pinnedIdRaw).trim();

    if (!pinnedCallId) {
      return Response.json({ pinnedCall: null });
    }

    const { data: call, error: callErr } = await db
      .from("call_performance")
      .select("id, call_ca, ath_multiple, spot_multiple, call_time")
      .eq("id", pinnedCallId)
      .eq("discord_id", discordId)
      .or(CALL_PERFORMANCE_VISIBLE_ON_DASHBOARD_OR)
      .or(CALL_PERFORMANCE_NOT_EXCLUDED_FROM_STATS_OR)
      .maybeSingle();

    if (callErr) {
      return Response.json({ error: callErr.message }, { status: 500 });
    }

    if (!call) {
      return Response.json({ pinnedCall: null });
    }

    const callRow = call as Record<string, unknown>;
    return Response.json({
      pinnedCall: {
        id: String((call as { id?: unknown }).id ?? ""),
        token: (call as { call_ca?: unknown }).call_ca ?? "Unknown",
        multiple: rowAthMultiple(callRow),
        time: (call as { call_time?: unknown }).call_time,
      },
    });
  } catch (e) {
    console.error("[pinned-call API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
