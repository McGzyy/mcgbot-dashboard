import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type Agg = {
  discord_id: string;
  username: string;
  totalCalls: number;
  sumX: number;
  wins: number;
};

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "bot";

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
      .eq("source", type);

    if (error) {
      console.error("Supabase error:", error);
      return Response.json(
        { error: "Failed to load leaderboard" },
        { status: 500 }
      );
    }

    const rows = Array.isArray(data) ? data : [];

    const map = new Map<string, Agg>();

    for (const row of rows) {
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
        const un =
          typeof r.username === "string" ? r.username.trim() : "";
        user = {
          discord_id: discordId,
          username: un,
          totalCalls: 0,
          sumX: 0,
          wins: 0,
        };
        map.set(discordId, user);
      }

      user.totalCalls += 1;
      user.sumX += mult;
      if (mult >= 2) user.wins += 1;
      if (typeof r.username === "string" && r.username.trim()) {
        user.username = r.username.trim();
      }
    }

    const results = Array.from(map.values()).map((user) => ({
      username: user.username || user.discord_id,
      avgX: user.sumX / user.totalCalls,
      totalCalls: user.totalCalls,
      wins: user.wins,
    }));

    results.sort((a, b) => b.avgX - a.avgX);

    const ranked = results.slice(0, 10).map((u, i) => ({
      rank: i + 1,
      ...u,
    }));

    return Response.json(ranked);
  } catch (e) {
    console.error("[leaderboard API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
