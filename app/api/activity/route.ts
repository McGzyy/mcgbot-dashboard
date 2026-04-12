import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
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
      .select("username, ath_multiple, call_time, source")
      .order("call_time", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Supabase error:", error);
      return Response.json(
        { error: "Failed to load activity" },
        { status: 500 }
      );
    }

    const rows = Array.isArray(data) ? data : [];

    const events = rows.map((row) => {
      const r = row as Record<string, unknown>;
      const multiple = Number(r.ath_multiple || 0);
      const username =
        typeof r.username === "string" && r.username.trim() !== ""
          ? r.username.trim()
          : "Unknown";

      if (multiple >= 2) {
        return {
          type: "win" as const,
          text: `${username} hit ${multiple.toFixed(1)}x`,
          time: r.call_time,
        };
      }

      return {
        type: "call" as const,
        text: `New call: ${username}`,
        time: r.call_time,
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
