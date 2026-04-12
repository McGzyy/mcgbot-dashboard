import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) {
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
      .eq("discord_id", discordId);

    if (error) {
      console.error("Supabase error:", error);
      return Response.json({ error: "Failed to load stats" }, { status: 500 });
    }

    const rows = Array.isArray(data) ? data : [];

    const totalCalls = rows.length;

    const avgX =
      totalCalls > 0
        ? rows.reduce(
            (sum, r) =>
              sum + Number((r as Record<string, unknown>).ath_multiple || 0),
            0
          ) / totalCalls
        : 0;

    const wins = rows.filter(
      (r) => Number((r as Record<string, unknown>).ath_multiple) >= 2
    ).length;

    const winRate = totalCalls > 0 ? (wins / totalCalls) * 100 : 0;

    const now = Date.now();
    const today = rows.filter((r) => {
      const ct = (r as Record<string, unknown>).call_time;
      const t = typeof ct === "number" ? ct : Number(ct);
      return Number.isFinite(t) && now - t < 86400000;
    }).length;

    return Response.json({
      avgX,
      winRate,
      callsToday: today,
      totalCalls,
    });
  } catch (e) {
    console.error("[me/stats API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
