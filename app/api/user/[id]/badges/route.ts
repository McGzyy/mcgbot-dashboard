import { createClient } from "@supabase/supabase-js";
import { TOP_CALLER_BADGE_KEY, topCallerBadgeToken } from "@/lib/topCallerBadgeDisplay";

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
      console.error("Missing Supabase env vars");
      return Response.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key);

    const { data, error } = await supabase
      .from("user_badges")
      .select("badge, times_awarded")
      .eq("user_id", profileUserId);

    if (error) {
      console.error("[user badges API] GET:", error);
      return Response.json(
        { error: "Failed to load badges" },
        { status: 500 }
      );
    }

    const rows = Array.isArray(data) ? data : [];
    const badges = rows
      .map((r) => {
        const row = r as Record<string, unknown>;
        const b = row.badge;
        const badge = typeof b === "string" ? b.trim() : String(b ?? "").trim();
        if (!badge) return "";
        const timesRaw = row.times_awarded;
        const times =
          typeof timesRaw === "number" && Number.isFinite(timesRaw)
            ? timesRaw
            : Number(timesRaw);
        if (
          badge === TOP_CALLER_BADGE_KEY &&
          Number.isFinite(times) &&
          times >= 1
        ) {
          return topCallerBadgeToken(times);
        }
        return badge;
      })
      .filter(Boolean);

    return Response.json(badges);
  } catch (e) {
    console.error("[user badges API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

