import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserTier } from "@/lib/getUserTier";
import { filterCallRowsForStats, getStatsCutoverUtcMs } from "@/lib/statsCutover";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    const tier = await getUserTier(userId);

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
      .select(
        "username, discord_id, ath_multiple, call_time, source, call_ca, message_url"
      );

    const t = tier.toLowerCase().trim();
    if (t === "free") {
      query = query.eq("source", "user");
    } else if (t === "pro") {
      query = query.in("source", ["user", "bot"]);
    }

    if (mode === "following") {
      if (!userId) {
        return Response.json([]);
      }

      const { data: follows, error: followError } = await supabase
        .from("follows")
        .select("following_discord_id")
        .eq("follower_discord_id", userId);

      if (followError) {
        console.error("[activity API] follows:", followError);
        return Response.json(
          { error: "Failed to load follows" },
          { status: 500 }
        );
      }

      const ids = (follows ?? [])
        .map((f) => {
          const row = f as { following_discord_id?: string | null };
          return row.following_discord_id;
        })
        .filter((id): id is string => typeof id === "string" && id.trim() !== "");

      if (ids.length === 0) {
        return Response.json([]);
      }

      query = query.in("discord_id", ids);
    }

    const [{ data, error }, cutoverMs] = await Promise.all([
      query.order("call_time", { ascending: false }).limit(40),
      getStatsCutoverUtcMs(),
    ]);

    if (error) {
      console.error("Supabase error:", error);
      return Response.json(
        { error: "Failed to load activity" },
        { status: 500 }
      );
    }

    const rawRows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const rows = filterCallRowsForStats(rawRows, cutoverMs).slice(0, 20);

    const events = rows.map((row) => {
      const r = row as Record<string, unknown>;
      const multiple = Number(r.ath_multiple || 0);
      const username =
        typeof r.username === "string" && r.username.trim() !== ""
          ? r.username.trim()
          : "Unknown";

      const discordRaw = r.discord_id;
      const discordId =
        typeof discordRaw === "string" && discordRaw.trim() !== ""
          ? discordRaw.trim()
          : "";

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
          username,
          time: r.call_time,
          link_chart,
          link_post,
          multiple,
          discordId,
        };
      }

      return {
        type: "call" as const,
        text: `New call by ${username}`,
        username,
        time: r.call_time,
        link_chart,
        link_post,
        multiple,
        discordId,
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
