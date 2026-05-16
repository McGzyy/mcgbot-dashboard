/**
 * Market snapshot for the dashboard (CoinGecko simple price).
 */

export const dynamic = "force-dynamic";
export const revalidate = 60;

const COINGECKO =
  "https://api.coingecko.com/api/v3/simple/price?ids=solana,bitcoin&vs_currencies=usd&include_24hr_change=true";

type CoingeckoSimple = {
  solana?: { usd?: number; usd_24h_change?: number };
  bitcoin?: { usd?: number; usd_24h_change?: number };
};

function readChange(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function readPrice(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET() {
  const fallback = {
    solPrice: 142.3,
    change24h: 0,
    btcPrice: 95_000,
    btcChange24h: 0,
  };

  try {
    const res = await fetch(COINGECKO, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.error("[market API] CoinGecko status:", res.status);
      return Response.json(fallback);
    }

    const data = (await res.json()) as CoingeckoSimple;
    const solPrice = readPrice(data?.solana?.usd);
    const btcPrice = readPrice(data?.bitcoin?.usd);

    if (solPrice == null) {
      return Response.json(fallback);
    }

    return Response.json({
      solPrice,
      change24h: readChange(data?.solana?.usd_24h_change),
      btcPrice: btcPrice ?? fallback.btcPrice,
      btcChange24h: readChange(data?.bitcoin?.usd_24h_change),
    });
  } catch (e) {
    console.error("[market API] GET:", e);
    return Response.json(fallback);
  }
}
