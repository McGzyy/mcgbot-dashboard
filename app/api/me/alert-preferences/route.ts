import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  clampAlertPrefsForProductTier,
  normalizeAlertPrefs,
} from "@/lib/dashboardAlertPrefs";
import { resolveUserProductTier } from "@/lib/subscription/productTierAccess";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim();
    if (!discordId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({
        prefs: normalizeAlertPrefs(null),
      });
    }

    const { data, error } = await db
      .from("user_dashboard_settings")
      .select("alert_prefs")
      .eq("discord_id", discordId)
      .maybeSingle();

    if (error) {
      console.error("[alert-preferences] GET:", error);
      return Response.json({
        prefs: normalizeAlertPrefs(null),
      });
    }

    const row = data as Record<string, unknown> | null;
    const prefs = normalizeAlertPrefs(row?.alert_prefs ?? null);
    return Response.json({ prefs });
  } catch (e) {
    console.error("[alert-preferences] GET:", e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim();
    if (!discordId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const prefsPayload =
      body && typeof body === "object"
        ? (body as Record<string, unknown>).prefs
        : undefined;
    const tier = await resolveUserProductTier(discordId);
    const prefs = clampAlertPrefsForProductTier(normalizeAlertPrefs(prefsPayload), tier);

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ error: "Database unavailable" }, { status: 503 });
    }

    const { error } = await db.from("user_dashboard_settings").upsert(
      {
        discord_id: discordId,
        alert_prefs: prefs as Record<string, unknown>,
      },
      { onConflict: "discord_id" }
    );

    if (error) {
      console.error("[alert-preferences] POST:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, prefs });
  } catch (e) {
    console.error("[alert-preferences] POST:", e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
