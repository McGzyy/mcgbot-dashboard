import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserTier } from "@/lib/getUserTier";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";

    const tier = await getUserTier(discordId);

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

    let query = supabase
      .from("call_performance")
      .select("username, ath_multiple, call_time, source, call_ca, message_url");

    const t = tier.toLowerCase().trim();
    if (t === "free") {
      query = query.eq("source", "user");
    } else if (t === "pro") {
      query = query.in("source", ["user", "bot"]);
    }

    const { data, error } = await query
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

      const rawCa =
        r.call_ca != null && String(r.call_ca).trim() !== ""
          ? String(r.call_ca).trim()
          : null;

      const callLabel = rawCa ?? "a call";

      const link_chart = rawCa
        ? `https://dexscreener.com/solana/${rawCa}`
        : null;

      const link_post =
        typeof r.message_url === "string" && r.message_url.trim() !== ""
          ? r.message_url.trim()
          : null;

      if (multiple >= 2) {
        return {
          type: "win" as const,
          text: `${username} hit ${multiple.toFixed(1)}x on ${callLabel}`,
          time: r.call_time,
          link_chart,
          link_post,
        };
      }

      return {
        type: "call" as const,
        text: `New call by ${username}`,
        time: r.call_time,
        link_chart,
        link_post,
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
