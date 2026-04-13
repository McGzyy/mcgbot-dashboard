import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const DEFAULTS = {
  own_calls: true,
  include_following: true,
  include_global: false,
  min_multiple: 2,
  sound_enabled: true,
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";
    if (!userId) {
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

    const supabase = createClient(url, key) as SupabaseClient;

    const { data, error } = await supabase
      .from("user_preferences")
      .select(
        "own_calls, include_following, include_global, min_multiple, sound_enabled"
      )
      .eq("discord_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[me/preferences] GET:", error);
      return Response.json({ ...DEFAULTS });
    }

    if (!data || typeof data !== "object") {
      return Response.json({ ...DEFAULTS });
    }

    const row = data as Record<string, unknown>;
    const minRaw = row.min_multiple;
    const minNum =
      typeof minRaw === "number" && Number.isFinite(minRaw)
        ? minRaw
        : Number(minRaw);
    const min_multiple = Number.isFinite(minNum) ? minNum : DEFAULTS.min_multiple;

    return Response.json({
      own_calls:
        typeof row.own_calls === "boolean"
          ? row.own_calls
          : DEFAULTS.own_calls,
      include_following:
        typeof row.include_following === "boolean"
          ? row.include_following
          : DEFAULTS.include_following,
      include_global:
        typeof row.include_global === "boolean"
          ? row.include_global
          : DEFAULTS.include_global,
      min_multiple,
      sound_enabled:
        typeof row.sound_enabled === "boolean"
          ? row.sound_enabled
          : DEFAULTS.sound_enabled,
    });
  } catch (e) {
    console.error("[me/preferences API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
