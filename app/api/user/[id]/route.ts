import { createClient } from "@supabase/supabase-js";

type CallRow = Record<string, unknown>;

function rowCallTime(row: CallRow): number {
  const t = row.call_time;
  if (typeof t === "number" && Number.isFinite(t)) return t;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

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

    const { data, error } = await supabase
      .from("call_performance")
      .select("*")
      .eq("discord_id", discordId);

    if (error) {
      console.error("[user API] GET:", error);
      return Response.json(
        { error: "Failed to load profile" },
        { status: 500 }
      );
    }

    const rows = (Array.isArray(data) ? data : []) as CallRow[];

    const sortedByTime = [...rows].sort(
      (a, b) => rowCallTime(b) - rowCallTime(a)
    );

    let username = "";
    for (const r of sortedByTime) {
      const u = r.username;
      if (typeof u === "string" && u.trim() !== "") {
        username = u.trim();
        break;
      }
    }
    if (!username) username = discordId;

    const totalCalls = rows.length;

    const avgX =
      totalCalls > 0
        ? rows.reduce(
            (sum, r) => sum + Number((r as CallRow).ath_multiple || 0),
            0
          ) / totalCalls
        : 0;

    const wins = rows.filter(
      (r) => Number((r as CallRow).ath_multiple) >= 2
    ).length;

    const winRate = totalCalls > 0 ? (wins / totalCalls) * 100 : 0;

    const recentCalls = sortedByTime.slice(0, 15).map((row) => {
      const r = row as CallRow;
      return {
        token: r.call_ca || "Unknown",
        multiple: Number(r.ath_multiple || 0),
        time: r.call_time,
      };
    });

    return Response.json({
      username,
      stats: {
        avgX,
        winRate,
        totalCalls,
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
