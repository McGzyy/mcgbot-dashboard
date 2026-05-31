import { NextResponse } from "next/server";
import {
  fetchTrendingSolanaTokens,
  type TrendingTimeframe,
} from "@/lib/dashboardTrendingFetch";

export const runtime = "nodejs";

/**
 * Trending = DexScreener top boosted Solana tokens, enriched with pair stats.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tfRaw = (searchParams.get("timeframe") || "1h").trim();
  const tf: TrendingTimeframe = tfRaw === "5m" || tfRaw === "24h" ? tfRaw : "1h";

  const health: Record<string, { ok: boolean; count: number; error?: string }> = {
    Dexscreener: { ok: false, count: 0 },
  };

  try {
    const top = await fetchTrendingSolanaTokens(tf, 24);
    health.Dexscreener = { ok: true, count: top.length };

    return NextResponse.json({
      rows: top.map((row) => ({
        ...row,
        source: "Dexscreener",
      })),
      health,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Trending fetch failed";
    health.Dexscreener = { ok: false, count: 0, error: msg };
    return NextResponse.json({ rows: [], health }, { status: 200 });
  }
}
