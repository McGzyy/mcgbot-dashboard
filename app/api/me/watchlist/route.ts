import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type WatchlistPayload = {
  private: string[];
  public: string[];
};

function createDashboardAdminClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

function normalizeMint(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  // Solana base58 mint addresses are typically 32-44 chars; allow a little slack.
  if (s.length < 20 || s.length > 60) return null;
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) return null;
  return s;
}

function normalizeList(raw: unknown): string[] {
  if (raw == null) return [];
  let arr: unknown = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      arr = JSON.parse(t) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const v of arr) {
    const mint = normalizeMint(v);
    if (mint && !out.includes(mint)) out.push(mint);
  }
  return out.slice(0, 200);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createDashboardAdminClient();
    if (!supabase) return Response.json({ error: "Supabase not configured" }, { status: 500 });

    // Use `.limit(1)` instead of `maybeSingle()`: duplicate `discord_id` rows (constraint drift /
    // legacy data) make PostgREST return PGRST116 for `maybeSingle()`, which broke POST adds while
    // GET silently fell back to empty lists.
    const { data: rows, error } = await supabase
      .from("user_dashboard_settings")
      .select("private_watchlist, public_dashboard_watchlist")
      .eq("discord_id", discordId)
      .limit(1);

    if (error) {
      console.error("[me/watchlist] GET:", error);
      return Response.json({ private: [], public: [] } satisfies WatchlistPayload);
    }

    const row = (rows?.[0] ?? {}) as Record<string, unknown>;
    const payload: WatchlistPayload = {
      private: normalizeList(row.private_watchlist),
      public: normalizeList(row.public_dashboard_watchlist),
    };
    return Response.json(payload);
  } catch (e) {
    console.error("[me/watchlist] GET exception:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const action =
      body && typeof body === "object" ? (body as Record<string, unknown>).action : null;
    const scope =
      body && typeof body === "object" ? (body as Record<string, unknown>).scope : null;

    const mint =
      body && typeof body === "object" ? normalizeMint((body as Record<string, unknown>).mint) : null;

    if (action !== "add" && action !== "remove") {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }
    if (scope !== "private" && scope !== "public") {
      return Response.json({ error: "Invalid scope" }, { status: 400 });
    }
    if (!mint) {
      return Response.json({ error: "Invalid mint" }, { status: 400 });
    }

    const botApiUrl = String(process.env.BOT_API_URL || "").trim();
    const internalSecret = String(process.env.CALL_INTERNAL_SECRET || "").trim();

    const supabase = createDashboardAdminClient();
    if (!supabase) return Response.json({ error: "Supabase not configured" }, { status: 500 });

    const { data: rows, error: readErr } = await supabase
      .from("user_dashboard_settings")
      .select("private_watchlist, public_dashboard_watchlist")
      .eq("discord_id", discordId)
      .limit(1);

    if (readErr) {
      // Same recovery as GET: never block adds on a read glitch or PostgREST edge case; if the row
      // truly cannot be written, upsert below will surface the real error.
      console.error("[me/watchlist] POST read (continuing with empty lists):", readErr);
    }

    const row = (rows?.[0] ?? {}) as Record<string, unknown>;
    const nextPrivate = normalizeList(row.private_watchlist);
    const nextPublic = normalizeList(row.public_dashboard_watchlist);

    const target = scope === "private" ? nextPrivate : nextPublic;
    if (action === "add") {
      if (!target.includes(mint)) target.unshift(mint);
    } else {
      const idx = target.indexOf(mint);
      if (idx >= 0) target.splice(idx, 1);
    }

    /**
     * IMPORTANT: "Public" watchlist acts like Discord `!watch`.
     * If adding to public and the bot host is not reachable/configured, fail the request
     * so the UI doesn't claim a watch that isn't actually being tracked.
     */
    if (action === "add" && scope === "public") {
      if (!botApiUrl || !internalSecret) {
        return Response.json(
          {
            error: "Bot watch is not configured (BOT_API_URL / CALL_INTERNAL_SECRET).",
          },
          { status: 503 }
        );
      }
      const watchRes = await fetch(`${botApiUrl.replace(/\/$/, "")}/internal/watch`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({ userId: discordId, ca: mint }),
      });
      const watchJson = (await watchRes.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!watchRes.ok || watchJson.success !== true) {
        return Response.json(
          {
            error:
              typeof watchJson.error === "string" && watchJson.error.trim()
                ? watchJson.error
                : "Could not submit watch to Discord.",
          },
          { status: 400 }
        );
      }
    }

    const { error: writeErr } = await supabase
      .from("user_dashboard_settings")
      .upsert(
        {
          discord_id: discordId,
          private_watchlist: nextPrivate,
          public_dashboard_watchlist: nextPublic,
        },
        { onConflict: "discord_id" }
      );

    if (writeErr) {
      console.error("[me/watchlist] POST write:", writeErr);
      return Response.json({ error: "Failed to save watchlist" }, { status: 500 });
    }

    return Response.json({ success: true, private: nextPrivate, public: nextPublic });
  } catch (e) {
    console.error("[me/watchlist] POST exception:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

