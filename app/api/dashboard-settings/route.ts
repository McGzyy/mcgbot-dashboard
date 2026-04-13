import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** Service-role client. PK is `id`; upserts must set `onConflict: "discord_id"`. */
function createDashboardAdminClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) {
    console.error(
      "[dashboard-settings] SUPABASE_URL is undefined or empty — cannot write"
    );
    return null;
  }
  if (!serviceKey) {
    console.error(
      "[dashboard-settings] SUPABASE_SERVICE_ROLE_KEY is undefined or empty — cannot write"
    );
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
    const rawUserId = session?.user?.id;
    const userId =
      typeof rawUserId === "string" ? rawUserId.trim() : "";
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const discordId = userId;
    console.log("GET SETTINGS FOR:", discordId);

    const supabase = createDashboardAdminClient();
    if (!supabase) {
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

    const discordId =
      typeof session.user?.id === "string" ? session.user.id.trim() : "";
    console.log("discordId (session.user.id):", discordId);

    if (!discordId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createDashboardAdminClient();
    if (!supabase) {
      return Response.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("user_dashboard_settings")
      .upsert(
        {
          discord_id: discordId,
          widgets_enabled,
        },
        { onConflict: "discord_id" }
      )
      .select();

    console.log("UPSERT RESULT:", data, error);

    if (error) {
      console.error("[dashboard-settings] POST upsert:", error);
      return Response.json({ error: "Failed to save" }, { status: 500 });
    }

    const { data: verifyData } = await supabase
      .from("user_dashboard_settings")
      .select("*")
      .eq("discord_id", discordId)
      .single();

    console.log("AFTER SAVE DB STATE:", verifyData);

    return Response.json({ success: true });
  } catch (e) {
    console.error("[dashboard-settings API] POST:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
