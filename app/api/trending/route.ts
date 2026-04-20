type Timeframe = "5m" | "1h" | "24h";
type Source = "Dexscreener" | "Axiom" | "Gecko";

export type TrendingTokenRow = {
  symbol: string;
  mint: string;
  priceUsd: number;
  changePct: number;
  liquidityUsd: number;
  volumeUsd: number;
  holders: number;
  source: Source;
  timeframe: Timeframe;
};

export async function GET(request: Request) {
  // First pass: return an empty, well-typed payload so UI is wired end-to-end.
  const { searchParams } = new URL(request.url);
  const timeframe = (searchParams.get("timeframe") ?? "1h").toLowerCase();
  const source = (searchParams.get("source") ?? "All").toLowerCase();

  const okTimeframe = timeframe === "5m" || timeframe === "1h" || timeframe === "24h";
  const okSource =
    source === "all" || source === "dexscreener" || source === "axiom" || source === "gecko";

  return Response.json({
    success: true,
    timeframe: okTimeframe ? timeframe : "1h",
    source: okSource ? source : "all",
    rows: [] as TrendingTokenRow[],
    updatedAt: new Date().toISOString(),
  });
}

