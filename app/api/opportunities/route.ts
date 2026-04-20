type SetupTimeframe = "5m" | "1h" | "4h";
type SetupMarket = "SOL Memes" | "Majors" | "New Pairs";

export type OpportunitySetup = {
  id: string;
  symbol: string;
  mint: string;
  setup: "Breakout" | "Reclaim" | "Sweep" | "VWAP Bounce" | "Rotation Leader";
  score: number;
  timeframe: SetupTimeframe;
  market: SetupMarket;
  trigger: string;
  invalidation: string;
  liquidityUsd: number;
  volumeUsd: number;
  note: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframeRaw = (searchParams.get("timeframe") ?? "5m").toLowerCase();
  const marketRaw = (searchParams.get("market") ?? "all").toLowerCase();

  const timeframe =
    timeframeRaw === "5m" || timeframeRaw === "1h" || timeframeRaw === "4h"
      ? (timeframeRaw as SetupTimeframe)
      : "5m";

  const market =
    marketRaw === "sol memes" || marketRaw === "majors" || marketRaw === "new pairs"
      ? (marketRaw as SetupMarket)
      : "all";

  return Response.json({
    success: true,
    timeframe,
    market,
    rows: [] as OpportunitySetup[],
    updatedAt: new Date().toISOString(),
  });
}

