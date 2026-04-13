import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** Server-only admin client; uses service role (not anon) to bypass RLS for this route. */
function createDashboardSettingsSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return null;
  }
  return createClient(url, serviceKey);
}

const WIDGET_KEYS = [
  "market",
  "top_performers",
  "rank",
  "activity",
  "trending",
  "notes",
] as const;

export type WidgetsEnabled = Record<(typeof WIDGET_KEYS)[number], boolean>;

const DEFAULT_WIDGETS: WidgetsEnabled = {
  market: true,
  top_performers: true,
  rank: true,
  activity: true,
  trending: true,
  notes: false,
};

function normalizeWidgets(raw: unknown): WidgetsEnabled {
  const out: WidgetsEnabled = { ...DEFAULT_WIDGETS };
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  for (const key of WIDGET_KEYS) {
    const v = o[key];
    if (typeof v === "boolean") out[key] = v;
  }
  return out;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const rawUserId = session?.user?.id || session?.user?.discordId;
    const userId =
      typeof rawUserId === "string" ? rawUserId.trim() : "";
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createDashboardSettingsSupabase();
    if (!supabase) {
      console.error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (dashboard-settings GET)"
      );
      return Response.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("user_dashboard_settings")
      .select("widgets_enabled")
      .eq("discord_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[dashboard-settings] GET:", error);
      return Response.json({ widgets_enabled: DEFAULT_WIDGETS });
    }

    if (!data || typeof data !== "object") {
      return Response.json({ widgets_enabled: DEFAULT_WIDGETS });
    }

    const row = data as Record<string, unknown>;
    const widgets_enabled = normalizeWidgets(row.widgets_enabled);

    return Response.json({ widgets_enabled });
  } catch (e) {
    console.error("[dashboard-settings API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    console.log("POST /api/dashboard-settings HIT");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    console.log("BODY:", body);

    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const { widgets_enabled: rawWidgets } = body as Record<string, unknown>;
    const widgets_enabled = normalizeWidgets(rawWidgets);

    const session = await getServerSession(authOptions);
    console.log("SESSION:", session?.user);

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const discordId = session.user?.id || session.user?.discordId;
    console.log("FINAL DISCORD ID:", discordId);

    const discordIdTrimmed =
      typeof discordId === "string" ? discordId.trim() : "";
    if (!discordIdTrimmed) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createDashboardSettingsSupabase();
    if (!supabase) {
      console.error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (dashboard-settings POST)"
      );
      return Response.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    console.log("Saving widgets:", widgets_enabled, discordIdTrimmed);

    const { error: ensureRowError } = await supabase
      .from("user_dashboard_settings")
      .upsert(
        { discord_id: discordIdTrimmed },
        { onConflict: "discord_id" }
      );

    if (ensureRowError) {
      console.error("[dashboard-settings] POST ensure row:", ensureRowError);
      return Response.json({ error: "Failed to save" }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("user_dashboard_settings")
      .upsert(
        {
          discord_id: discordIdTrimmed,
          widgets_enabled,
        },
        { onConflict: "discord_id" }
      )
      .select();

    console.log("UPSERT DATA:", data);
    console.log("UPSERT ERROR:", error);

    if (error) {
      console.error("[dashboard-settings] POST upsert:", error);
      return Response.json({ error: "Failed to save" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (e) {
    console.error("[dashboard-settings API] POST:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
