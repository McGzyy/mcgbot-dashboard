import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const DEFAULTS = {
  own_calls: true,
  include_following: true,
  include_global: false,
  min_multiple: 2,
  sound_enabled: true,
  sound_type: "classic" as const,
};

type SoundType = "classic" | "soft_pop" | "soft_chime";

function parseSoundType(raw: unknown): SoundType {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "soft_pop") return "soft_pop";
  if (s === "soft_chime") return "soft_chime";
  return "classic";
}

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
        "own_calls, include_following, include_global, min_multiple, sound_enabled, sound_type"
      )
      .eq("discord_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[preferences] GET:", error);
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
      sound_type: parseSoundType((row as any).sound_type ?? DEFAULTS.sound_type),
    });
  } catch (e) {
    console.error("[preferences API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const o = body as Record<string, unknown>;

    const own_calls =
      typeof o.own_calls === "boolean" ? o.own_calls : DEFAULTS.own_calls;
    const include_following =
      typeof o.include_following === "boolean"
        ? o.include_following
        : DEFAULTS.include_following;
    const include_global =
      typeof o.include_global === "boolean"
        ? o.include_global
        : DEFAULTS.include_global;

    const minRaw = o.min_multiple;
    const minNum =
      typeof minRaw === "number" && Number.isFinite(minRaw)
        ? minRaw
        : Number(minRaw);
    const min_multiple = Number.isFinite(minNum) ? minNum : DEFAULTS.min_multiple;

    const sound_enabled =
      typeof o.sound_enabled === "boolean"
        ? o.sound_enabled
        : DEFAULTS.sound_enabled;

    const sound_type = parseSoundType(o.sound_type ?? DEFAULTS.sound_type);

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

    const { error } = await supabase.from("user_preferences").upsert(
      {
        discord_id: userId,
        own_calls,
        include_following,
        include_global,
        min_multiple,
        sound_enabled,
        sound_type,
      },
      { onConflict: "discord_id" }
    );

    if (error) {
      console.error("[preferences] POST upsert:", error);
      return Response.json({ error: "Failed to save preferences" }, { status: 500 });
    }

    return Response.json({
      ok: true,
      own_calls,
      include_following,
      include_global,
      min_multiple,
      sound_enabled,
      sound_type,
    });
  } catch (e) {
    console.error("[preferences API] POST:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
