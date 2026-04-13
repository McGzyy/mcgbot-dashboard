/**
 * Market snapshot for the dashboard banner.
 * SOL data from CoinGecko; PumpFun metrics are placeholders until wired to real feeds.
 */

const PLACEHOLDER_PUMP_VOLUME = 2_400_000;
const PLACEHOLDER_ACTIVE_TRADERS = 1284;

const COINGECKO =
  "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true";

export const revalidate = 60;

type CoingeckoSimple = {
  solana?: { usd?: number; usd_24h_change?: number };
};

export async function GET() {
  const fallback = {
    solPrice: 142.3,
    change24h: 0,
    pumpVolume: PLACEHOLDER_PUMP_VOLUME,
    activeTraders: PLACEHOLDER_ACTIVE_TRADERS,
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
    const sol = data?.solana;
    const solPrice = Number(sol?.usd);
    const rawChange = sol?.usd_24h_change;
    const change24h =
      typeof rawChange === "number" && Number.isFinite(rawChange)
        ? rawChange
        : Number(rawChange);

    if (!Number.isFinite(solPrice) || solPrice <= 0) {
      return Response.json(fallback);
    }

    return Response.json({
      solPrice,
      change24h: Number.isFinite(change24h) ? change24h : 0,
      pumpVolume: PLACEHOLDER_PUMP_VOLUME,
      activeTraders: PLACEHOLDER_ACTIVE_TRADERS,
    });
  } catch (e) {
    console.error("[market API] GET:", e);
    return Response.json(fallback);
  }
}
