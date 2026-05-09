import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TrendingTf = "5m" | "1h" | "24h";

type DexPair = {
  chainId?: string;
  baseToken?: { address?: string; symbol?: string; name?: string };
  quoteToken?: { address?: string };
  priceUsd?: string | number;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { m5?: number; h1?: number; h24?: number };
  priceChange?: { m5?: number; h1?: number; h24?: number };
  info?: { imageUrl?: string };
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickWindow(
  pair: DexPair,
  tf: TrendingTf
): { volumeUsd: number; changePct: number } {
  const v = pair.volume || {};
  const pc = pair.priceChange || {};
  if (tf === "5m") return { volumeUsd: num(v.m5), changePct: num(pc.m5) };
  if (tf === "1h") return { volumeUsd: num(v.h1), changePct: num(pc.h1) };
  return { volumeUsd: num(v.h24), changePct: num(pc.h24) };
}

function bestSolanaPairForMint(pairs: DexPair[], mint: string): DexPair | null {
  const list = pairs.filter(
    (p) =>
      String(p?.chainId || "").toLowerCase() === "solana" &&
      String(p?.baseToken?.address || "") === mint
  );
  if (!list.length) return null;
  return list.reduce((a, b) => (num(b.liquidity?.usd) > num(a.liquidity?.usd) ? b : a));
}

type BoostEntry = { chainId?: string; tokenAddress?: string };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * Trending = DexScreener top boosted Solana tokens, enriched with pair stats.
 * 5m / 1h / 24h use Dex pair `volume` + `priceChange` for that window (not a mismatched label).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tfRaw = (searchParams.get("timeframe") || "1h").trim();
  const tf: TrendingTf = tfRaw === "5m" || tfRaw === "24h" ? tfRaw : "1h";

  const health: Record<string, { ok: boolean; count: number; error?: string }> = {
    Dexscreener: { ok: false, count: 0 },
  };

  try {
    const boosts = await fetchJson<BoostEntry[]>("https://api.dexscreener.com/token-boosts/top/v1");
    const solMints = (Array.isArray(boosts) ? boosts : [])
      .filter((b) => String(b?.chainId || "").toLowerCase() === "solana" && typeof b?.tokenAddress === "string")
      .map((b) => String(b.tokenAddress).trim())
      .filter(Boolean);

    const unique: string[] = [];
    for (const m of solMints) {
      if (!unique.includes(m)) unique.push(m);
      if (unique.length >= 36) break;
    }

    const pairPool: DexPair[] = [];
    const chunk = 18;
    for (let i = 0; i < unique.length; i += chunk) {
      const slice = unique.slice(i, i + chunk);
      if (!slice.length) continue;
      const url = `https://api.dexscreener.com/latest/dex/tokens/${slice.map(encodeURIComponent).join(",")}`;
      const body = await fetchJson<{ pairs?: DexPair[] }>(url);
      const pairs = Array.isArray(body?.pairs) ? body.pairs : [];
      pairPool.push(...pairs);
    }

    const rows: Record<string, unknown>[] = [];
    for (const mint of unique) {
      const pair = bestSolanaPairForMint(pairPool, mint);
      if (!pair) continue;
      const { volumeUsd, changePct } = pickWindow(pair, tf);
      const symbol = String(pair.baseToken?.symbol || pair.baseToken?.name || "???").trim() || "???";
      const imageUrl =
        typeof pair.info?.imageUrl === "string" && pair.info.imageUrl.startsWith("http")
          ? pair.info.imageUrl
          : null;

      rows.push({
        symbol,
        mint,
        imageUrl,
        priceUsd: num(pair.priceUsd),
        marketCapUsd: num(pair.marketCap) || num(pair.fdv),
        changePct,
        liquidityUsd: num(pair.liquidity?.usd),
        volumeUsd,
        holders: 0,
        source: "Dexscreener",
        timeframe: tf,
      });
    }

    rows.sort((a, b) => num(b.volumeUsd) - num(a.volumeUsd));
    const top = rows.slice(0, 24);

    health.Dexscreener = { ok: true, count: top.length };

    return NextResponse.json({ rows: top, health });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Trending fetch failed";
    health.Dexscreener = { ok: false, count: 0, error: msg };
    return NextResponse.json({ rows: [], health }, { status: 200 });
  }
}
