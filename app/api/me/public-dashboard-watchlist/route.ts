import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isLikelySolanaMint } from "@/lib/solanaCa";

const MAX_ITEMS = 80;

function createDashboardAdminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey) as SupabaseClient;
}

function normalizeList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x === "string") {
      const t = x.trim();
      if (t && isLikelySolanaMint(t) && !out.includes(t)) out.push(t);
    }
  }
  return out.slice(0, MAX_ITEMS);
}

/** Append a public-dashboard watch mint (after bot /api/watch succeeds). */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return Response.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const ca = String((body as Record<string, unknown>).ca ?? "").trim();
    if (!ca || !isLikelySolanaMint(ca)) {
      return Response.json(
        { success: false, error: "Invalid or missing Solana contract address" },
        { status: 400 }
      );
    }

    const supabase = createDashboardAdminClient();
    if (!supabase) {
      return Response.json(
        {
          success: false,
          error:
            "Supabase service role not configured; cannot save public watchlist entry.",
        },
        { status: 503 }
      );
    }

    const { data: existing, error: readErr } = await supabase
      .from("user_dashboard_settings")
      .select("widgets_enabled, private_watchlist, public_dashboard_watchlist")
      .eq("discord_id", discordId)
      .maybeSingle();

    if (readErr) {
      console.error("[me/public-dashboard-watchlist] POST read:", readErr.message);
      return Response.json(
        { success: false, error: readErr.message },
        { status: 500 }
      );
    }

    const row = existing as Record<string, unknown> | null;
    const widgets =
      row?.widgets_enabled && typeof row.widgets_enabled === "object"
        ? row.widgets_enabled
        : {
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

    const privateList = normalizeList(row?.private_watchlist);
    const prevPublic = normalizeList(row?.public_dashboard_watchlist);
    const nextPublic = [ca, ...prevPublic.filter((x) => x !== ca)].slice(0, MAX_ITEMS);

    const { error: upsertErr } = await supabase
      .from("user_dashboard_settings")
      .upsert(
        {
          discord_id: discordId,
          widgets_enabled: widgets,
          private_watchlist: privateList,
          public_dashboard_watchlist: nextPublic,
        },
        { onConflict: "discord_id" }
      );

    if (upsertErr) {
      console.error("[me/public-dashboard-watchlist] POST upsert:", upsertErr.message);
      if (
        upsertErr.message?.includes("public_dashboard_watchlist") ||
        upsertErr.code === "42703"
      ) {
        return Response.json(
          {
            success: false,
            error:
              "Database column public_dashboard_watchlist is missing. Apply the latest Supabase migration.",
          },
          { status: 503 }
        );
      }
      return Response.json(
        { success: false, error: upsertErr.message },
        { status: 500 }
      );
    }

    return Response.json({ success: true, public: nextPublic });
  } catch (e) {
    console.error("[me/public-dashboard-watchlist] POST exception:", e);
    return Response.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
