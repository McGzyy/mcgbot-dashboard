import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type Agg = {
  discord_id: string;
  totalCalls: number;
  sumX: number;
};

function rowCallTime(row: Record<string, unknown>): number {
  const t = row.call_time;
  if (typeof t === "number" && Number.isFinite(t)) return t;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

/** Rolling 7-day window, same aggregation as leaderboard (user source, avgX sort). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const selfId = session?.user?.id?.trim() ?? "";
    if (!selfId) {
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
      .select("*")
      .eq("source", "user");

    if (error) {
      console.error("[me/leaderboard-rank] GET:", error);
      return Response.json(
        { error: "Failed to load rank" },
        { status: 500 }
      );
    }

    const now = Date.now();
    const weekMs = 7 * 86_400_000;
    let rows = Array.isArray(data) ? data : [];
    rows = rows.filter((row) => {
      const t = rowCallTime(row as Record<string, unknown>);
      return t > 0 && now - t < weekMs;
    });

    const sorted = [...rows].sort(
      (a, b) =>
        rowCallTime(a as Record<string, unknown>) -
        rowCallTime(b as Record<string, unknown>)
    );

    const map = new Map<string, Agg>();

    for (const row of sorted) {
      const r = row as Record<string, unknown>;
      const discordId =
        typeof r.discord_id === "string"
          ? r.discord_id.trim()
          : String(r.discord_id ?? "").trim();
      if (!discordId) continue;

      const mult =
        typeof r.ath_multiple === "number" && Number.isFinite(r.ath_multiple)
          ? r.ath_multiple
          : Number(r.ath_multiple);
      if (!Number.isFinite(mult)) continue;

      let user = map.get(discordId);
      if (!user) {
        user = {
          discord_id: discordId,
          totalCalls: 0,
          sumX: 0,
        };
        map.set(discordId, user);
      }

      user.totalCalls += 1;
      user.sumX += mult;
    }

    const results = Array.from(map.values()).map((u) => ({
      discordId: u.discord_id,
      avgX: u.sumX / u.totalCalls,
    }));

    results.sort((a, b) => b.avgX - a.avgX);

    const idx = results.findIndex((r) => r.discordId === selfId);
    const rank = idx === -1 ? null : idx + 1;

    return Response.json({
      rank,
      totalRanked: results.length,
    });
  } catch (e) {
    console.error("[me/leaderboard-rank API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
