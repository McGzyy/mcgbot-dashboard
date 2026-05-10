import { fetchBot7dHitRates } from "@/lib/copyTrade/bot7dHitRates";
import { getStatsCutoverUtcMs } from "@/lib/statsCutover";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
