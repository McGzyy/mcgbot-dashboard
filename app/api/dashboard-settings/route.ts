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
  "live_tracked_calls",
  "top_performers",
  "rank",
  "activity",
  "trending",
  "notes",
  "recent_calls",
  "referral_link",
  "referrals",
  "hot_now",
  "quick_actions",
] as const;

export type WidgetsEnabled = Record<(typeof WIDGET_KEYS)[number], boolean>;

const DEFAULT_WIDGETS: WidgetsEnabled = {
  market: true,
  live_tracked_calls: true,
  top_performers: true,
  rank: true,
  activity: true,
  trending: true,
  notes: false,
  recent_calls: true,
  referral_link: true,
  referrals: true,
  hot_now: true,
  quick_actions: true,
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
    const discordId = session?.user?.id;
    if (!discordId) {
      return Response.json({ error: "No user ID" }, { status: 401 });
    }

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
      .eq("discord_id", discordId)
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
    const hasUrl = !!process.env.SUPABASE_URL?.trim();
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    console.log("[dashboard-settings] POST env check:", {
      hasSupabaseUrl: hasUrl,
      hasSupabaseServiceRoleKey: hasServiceKey,
    });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json({ error: "No session user id" }, { status: 401 });
    }

    const discordId = session.user.id;
    const rawWidgets =
      body && typeof body === "object"
        ? (body as Record<string, unknown>).widgets_enabled
        : undefined;
    const widgets_enabled = normalizeWidgets(rawWidgets);

    console.log("[dashboard-settings] POST:", {
      discordId,
      widgets_enabled,
    });

    const supabase = createDashboardAdminClient();
    if (!supabase) {
      console.error(
        "[dashboard-settings] POST: Supabase admin client unavailable (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)"
      );
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
      .select("id, discord_id, widgets_enabled, created_at")
      .maybeSingle();

    if (error) {
      console.error("[dashboard-settings] POST upsert error:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      console.error(
        "[dashboard-settings] POST: upsert returned no row (unexpected)"
      );
      return Response.json(
        { error: "Save did not return a row" },
        { status: 500 }
      );
    }

    console.log("[dashboard-settings] POST upsert ok:", {
      discordId: data.discord_id,
      widgets_enabled: data.widgets_enabled,
    });

    return Response.json({ success: true, data });
  } catch (err) {
    console.error("[dashboard-settings] POST exception:", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
