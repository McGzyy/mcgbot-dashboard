import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  loadUserWatchlist,
  normalizeWatchlistContractAddress,
  saveUserWatchlist,
  type WatchlistPayload,
} from "@/lib/userDashboardWatchlist";

function createDashboardAdminClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createDashboardAdminClient();
    if (!supabase) return Response.json({ error: "Supabase not configured" }, { status: 500 });

    const { payload, readError } = await loadUserWatchlist(supabase, discordId);
    if (readError) {
      console.error("[me/watchlist] GET:", readError);
    }
    return Response.json(payload satisfies WatchlistPayload);
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

    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const action = o.action;
    const scope = o.scope;
    const contractAddress = normalizeWatchlistContractAddress(
      o.contractAddress ?? o.ca ?? o.mint
    );

    if (action !== "add" && action !== "remove") {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }
    if (scope !== "private" && scope !== "public") {
      return Response.json({ error: "Invalid scope" }, { status: 400 });
    }
    if (!contractAddress) {
      return Response.json(
        {
          error:
            "Invalid contract address — paste the CA only, or a Dexscreener / Solscan link.",
        },
        { status: 400 }
      );
    }

    const supabase = createDashboardAdminClient();
    if (!supabase) return Response.json({ error: "Supabase not configured" }, { status: 500 });

    const { payload, row, readError } = await loadUserWatchlist(supabase, discordId);
    if (readError) {
      console.error("[me/watchlist] POST read (continuing with empty lists):", readError);
    }

    const nextPrivate = [...payload.private];
    const nextPublic = [...payload.public];
    const target = scope === "private" ? nextPrivate : nextPublic;

    if (action === "add") {
      if (!target.includes(contractAddress)) target.unshift(contractAddress);
    } else {
      const idx = target.indexOf(contractAddress);
      if (idx >= 0) target.splice(idx, 1);
    }

    const nextPayload: WatchlistPayload = {
      private: nextPrivate,
      public: nextPublic,
    };

    const { error: writeErr } = await saveUserWatchlist(supabase, discordId, nextPayload, row);
    if (writeErr) {
      console.error("[me/watchlist] POST write:", writeErr);
      const msg = writeErr.message ?? "";
      if (msg.includes("private_watchlist") || msg.includes("public_dashboard_watchlist")) {
        return Response.json(
          {
            error:
              "Watchlist columns are missing in Supabase. Apply migrations for user_dashboard_settings.",
          },
          { status: 503 }
        );
      }
      return Response.json({ error: "Failed to save watchlist" }, { status: 500 });
    }

    let discordWatchNote: string | null = null;

    if (action === "add" && scope === "public") {
      const botApiUrl = String(process.env.BOT_API_URL || "").trim();
      const internalSecret = String(process.env.CALL_INTERNAL_SECRET || "").trim();

      if (botApiUrl && internalSecret) {
        try {
          const watchRes = await fetch(`${botApiUrl.replace(/\/$/, "")}/internal/watch`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${internalSecret}`,
            },
            body: JSON.stringify({ userId: discordId, ca: contractAddress }),
          });
          const watchJson = (await watchRes.json().catch(() => ({}))) as {
            success?: boolean;
            error?: string;
          };
          if (!watchRes.ok || watchJson.success !== true) {
            const botErr =
              typeof watchJson.error === "string" && watchJson.error.trim()
                ? watchJson.error.trim()
                : "Could not post to #user-calls.";
            console.warn("[me/watchlist] bot watch (saved to dashboard):", botErr);
            discordWatchNote = `Saved on your dashboard. Discord watch failed: ${botErr} You can use !watch in the server.`;
          }
        } catch (e) {
          console.error("[me/watchlist] bot watch (saved to dashboard):", e);
          discordWatchNote =
            "Saved on your dashboard. Discord bot was unreachable — use !watch in the server for channel tracking.";
        }
      } else {
        discordWatchNote =
          "Saved to your public dashboard list (Discord bot watch is not configured on this environment).";
      }
    }

    return Response.json({
      success: true,
      private: nextPayload.private,
      public: nextPayload.public,
      ...(discordWatchNote ? { note: discordWatchNote } : {}),
    });
  } catch (e) {
    console.error("[me/watchlist] POST exception:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
