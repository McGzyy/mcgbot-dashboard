import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type CallRow = {
  call_ca?: unknown;
  ath_multiple?: unknown;
  call_time?: unknown;
};

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
      .select("call_ca, ath_multiple, call_time")
      .eq("discord_id", discordId)
      .order("call_time", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Supabase error:", error);
      return Response.json(
        { error: "Failed to load recent calls" },
        { status: 500 }
      );
    }

    const rows = (Array.isArray(data) ? data : []) as CallRow[];

    return Response.json(
      rows.map((row) => ({
        token: row.call_ca || "Unknown",
        multiple: Number(row.ath_multiple || 0),
        time: row.call_time,
      }))
    );
  } catch (e) {
    console.error("[me/recent-calls API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
