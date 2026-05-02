import { createClient } from "@supabase/supabase-js";
import {
  CALL_PERFORMANCE_NOT_EXCLUDED_FROM_STATS_OR,
  CALL_PERFORMANCE_VISIBLE_ON_DASHBOARD_OR,
} from "@/lib/callPerformanceDashboardVisibility";
import { rowAthMultiple } from "@/lib/callPerformanceMultiples";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await context.params;
    const profileUserId = decodeURIComponent(String(rawId ?? "")).trim();
    if (!profileUserId || profileUserId.length > 64) {
      return Response.json({ error: "Invalid user id" }, { status: 400 });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.error("[pinned-call API] Missing Supabase env vars");
      return Response.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key);

    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("pinned_call_id")
      .eq("discord_id", profileUserId)
      .maybeSingle();

    console.log("PINNED CALL USER RESULT:", user, userErr);

    if (userErr) {
      return Response.json({ error: userErr.message }, { status: 500 });
    }

    const pinnedIdRaw = (user as any)?.pinned_call_id;
    const pinnedCallId =
      typeof pinnedIdRaw === "string"
        ? pinnedIdRaw.trim()
        : pinnedIdRaw == null
          ? ""
          : String(pinnedIdRaw).trim();

    if (!pinnedCallId) {
      return Response.json({ pinnedCall: null });
    }

    const { data: call, error: callErr } = await supabase
      .from("call_performance")
      .select("id, call_ca, ath_multiple, spot_multiple, call_time")
      .eq("id", pinnedCallId)
      .eq("discord_id", profileUserId)
      .or(CALL_PERFORMANCE_VISIBLE_ON_DASHBOARD_OR)
      .or(CALL_PERFORMANCE_NOT_EXCLUDED_FROM_STATS_OR)
      .maybeSingle();

    console.log("PINNED CALL RESULT:", call, callErr);

    if (callErr) {
      return Response.json({ error: callErr.message }, { status: 500 });
    }

    if (!call) {
      return Response.json({ pinnedCall: null });
    }

    const callRow = call as Record<string, unknown>;
    return Response.json({
      pinnedCall: {
        id: String((call as any).id ?? ""),
        token: (call as any).call_ca ?? "Unknown",
        multiple: rowAthMultiple(callRow),
        time: (call as any).call_time,
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

