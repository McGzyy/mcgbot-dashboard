import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { readCopyTradePagePublicEnabled } from "@/lib/dashboardKv";
import { fetchBot7dHitRates } from "@/lib/copyTrade/bot7dHitRates";
import { copyTradeStaffBypass } from "@/lib/copyTrade/copyTradeAccess";
import { getStatsCutoverUtcMs } from "@/lib/statsCutover";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user?.id?.trim() ?? "";
    if (!session?.user?.id || !uid) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const ht = session.user.helpTier;
    const helpTier = ht === "admin" || ht === "mod" || ht === "user" ? ht : "user";

    const botId = (process.env.COPY_TRADE_BOT_STATS_DISCORD_ID ?? "").trim();
    if (!botId) {
      return Response.json(
        { ok: false, error: "COPY_TRADE_BOT_STATS_DISCORD_ID is not configured." },
        { status: 503 }
      );
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
    }

    if (!copyTradeStaffBypass(helpTier)) {
      const pageOpen = await readCopyTradePagePublicEnabled(db);
      if (!pageOpen) {
        return Response.json({ ok: false, error: "Copy trade is not available yet." }, { status: 403 });
      }
    }

    const cutoverUtcMs = await getStatsCutoverUtcMs();
    const stats = await fetchBot7dHitRates(db, { botStatsDiscordId: botId, cutoverUtcMs });
    if (!stats) {
      return Response.json({ ok: false, error: "Could not load bot stats." }, { status: 500 });
    }

    return Response.json({ ok: true, ...stats });
  } catch (e) {
    console.error("[copy-trade/bot-7d GET]", e);
    return Response.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
