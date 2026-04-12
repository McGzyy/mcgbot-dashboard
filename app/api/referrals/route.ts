import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

let supabaseSingleton: SupabaseClient | null | undefined;

function getSupabase(): SupabaseClient | null {
  if (supabaseSingleton !== undefined) return supabaseSingleton;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    supabaseSingleton = null;
    return null;
  }
  supabaseSingleton = createClient(url, key);
  return supabaseSingleton;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim();
    if (!discordId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return Response.json(
        { error: "Referrals service not configured" },
        { status: 503 }
      );
    }

    const normalizedId = String(discordId).trim();

    console.log("SESSION USER ID:", discordId);

    const { data, error } = await supabase
      .from("referrals")
      .select("*")
      .eq("owner_discord_id", normalizedId);

    console.log("QUERY ID:", normalizedId);
    console.log("ROWS RETURNED:", data);

    if (error) {
      console.error("[referrals API] Supabase:", error.message);
      return Response.json({ error: "Failed to load referrals" }, { status: 500 });
    }

    const rows = data ?? [];

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;

    const total = rows.length;
    const today = rows.filter((r) => {
      const t = joinedAtMs(r);
      return t >= now - day;
    }).length;
    const weekCount = rows.filter((r) => {
      const t = joinedAtMs(r);
      return t >= now - week;
    }).length;

    return Response.json({
      total,
      today,
      week: weekCount,
      referrals: rows,
    });
  } catch (e) {
    console.error("[referrals API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

function joinedAtMs(r: { joined_at?: unknown }): number {
  const v = r.joined_at;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    const parsed = Date.parse(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}
