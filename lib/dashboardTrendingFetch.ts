import { dexScreenerSolTokenPngUrl } from "@/lib/resolveTokenAvatarUrl";

export type TrendingTimeframe = "5m" | "1h" | "24h";

export type TrendingTokenSnapshot = {
  symbol: string;
  mint: string;
  imageUrl: string;
  priceUsd: number;
  marketCapUsd: number;
  changePct: number;
  liquidityUsd: number;
  volumeUsd: number;
  timeframe: TrendingTimeframe;
};

type DexPair = {
  chainId?: string;
  baseToken?: { address?: string; symbol?: string; name?: string };
  priceUsd?: string | number;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { m5?: number; h1?: number; h24?: number };
  priceChange?: { m5?: number; h1?: number; h24?: number };
  info?: { imageUrl?: string };
};

type BoostEntry = { chainId?: string; tokenAddress?: string };

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickWindow(
  pair: DexPair,
  tf: TrendingTimeframe
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

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** DexScreener top boosted Solana tokens (same source as dashboard Trending panel). */
export async function fetchTrendingSolanaTokens(
  tf: TrendingTimeframe = "1h",
  limit = 24
): Promise<TrendingTokenSnapshot[]> {
  const cap = Math.min(36, Math.max(1, Math.floor(limit)));
  try {
    const boosts = await fetchJson<BoostEntry[]>("https://api.dexscreener.com/token-boosts/top/v1");
    const solMints = (Array.isArray(boosts) ? boosts : [])
      .filter(
        (b) =>
          String(b?.chainId || "").toLowerCase() === "solana" &&
          typeof b?.tokenAddress === "string"
      )
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

    const rows: TrendingTokenSnapshot[] = [];
    for (const mint of unique) {
      const pair = bestSolanaPairForMint(pairPool, mint);
      if (!pair) continue;
      const { volumeUsd, changePct } = pickWindow(pair, tf);
      const symbol = String(pair.baseToken?.symbol || pair.baseToken?.name || "???").trim() || "???";
      const imageUrl =
        typeof pair.info?.imageUrl === "string" && pair.info.imageUrl.startsWith("http")
          ? pair.info.imageUrl
          : dexScreenerSolTokenPngUrl(mint) ?? "";

      rows.push({
        symbol,
        mint,
        imageUrl,
        priceUsd: num(pair.priceUsd),
        marketCapUsd: num(pair.marketCap) || num(pair.fdv),
        changePct,
        liquidityUsd: num(pair.liquidity?.usd),
        volumeUsd,
        timeframe: tf,
      });
    }

    rows.sort((a, b) => b.volumeUsd - a.volumeUsd);
    return rows.slice(0, cap);
  } catch (e) {
    console.warn(
      "[dashboardTrendingFetch]",
      e instanceof Error ? e.message : e
    );
    return [];
  }
}
