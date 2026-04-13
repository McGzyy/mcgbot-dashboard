import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
    const widgets_enabled = normalizeWidgets(o.widgets_enabled);

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

    const { error } = await supabase.from("user_dashboard_settings").upsert(
      {
        discord_id: userId,
        widgets_enabled,
      },
      { onConflict: "discord_id" }
    );

    if (error) {
      console.error("[dashboard-settings] POST upsert:", error);
      return Response.json(
        { error: "Failed to save dashboard settings" },
        { status: 500 }
      );
    }

    return Response.json({ ok: true, widgets_enabled });
  } catch (e) {
    console.error("[dashboard-settings API] POST:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
