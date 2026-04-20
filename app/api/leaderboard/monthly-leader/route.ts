import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTopLeaderSince } from "@/lib/callPerformanceLeaderboard";
import { hasAccess } from "@/lib/hasAccess";
import { startOfCalendarMonthUtcMs } from "@/lib/leaderboardTimeWindows";
import { getStatsCutoverUtcMs, mergeStatsCutoverIntoMin } from "@/lib/statsCutover";

// MONTHLY LEADER = resets first day of month 00:00 UTC

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let type = searchParams.get("type") || "user";

    if (type === "bot") {
      const allowed = await hasAccess(userId, "view_bot_calls");
      if (!allowed) type = "user";
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
    const now = Date.now();
    const cutoverMs = await getStatsCutoverUtcMs();
    const minMs = mergeStatsCutoverIntoMin(startOfCalendarMonthUtcMs(now), cutoverMs);

    const leader = await getTopLeaderSince(supabase, type, minMs);

    return Response.json({ leader });
  } catch (e) {
    console.error("[leaderboard/monthly-leader] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
