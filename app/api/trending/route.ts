const CACHE_TTL_MS = 25_000;
const FETCH_TIMEOUT_MS = 8_000;

type Timeframe = "5m" | "1h" | "24h";
type Source = "All" | "Dexscreener" | "Gecko" | "Axiom" | "GMGN";

type TrendingTokenRow = {
  symbol: string;
  mint: string;
  priceUsd: number;
  changePct: number;
  liquidityUsd: number;
  volumeUsd: number;
  holders: number;
  source: Exclude<Source, "All">;
  timeframe: Timeframe;
};

type CacheEntry = { at: number; payload: { rows: TrendingTokenRow[] } };
const cache = new Map<string, CacheEntry>();

function clampTimeframe(tf: string | null): Timeframe {
  if (tf === "5m" || tf === "1h" || tf === "24h") return tf;
  return "1h";
}

function clampSource(src: string | null): Source {
  if (src === "All" || src === "Dexscreener" || src === "Gecko" || src === "Axiom" || src === "GMGN") {
    return src;
  }
  return "All";
}

function pickTimeKey(tf: Timeframe): "m5" | "h1" | "h24" {
  if (tf === "5m") return "m5";
  if (tf === "24h") return "h24";
  return "h1";
}

function asNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v ?? NaN);
  return Number.isFinite(n) ? n : 0;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: ac.signal,
      headers: {
        accept: "application/json",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": "mcgbot-dashboard/1.0 (+https://mcgbot.xyz)",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function loadDexscreenerHeuristic(tf: Timeframe, limit: number): Promise<TrendingTokenRow[]> {
  const timeKey = pickTimeKey(tf);
  const candidates: Array<{ chainId: string; tokenAddress: string }> = [];

  const sources = [
    "https://api.dexscreener.com/token-profiles/latest/v1",
    "https://api.dexscreener.com/token-profiles/recent-updates/v1",
  ];

  for (const url of sources) {
    try {
      const json = (await fetchJson(url)) as unknown;
      const arr = Array.isArray(json) ? (json as unknown[]) : [];
      for (const item of arr) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        const chainId = String(o.chainId ?? "").toLowerCase();
        if (chainId !== "solana") continue;
        const tokenAddress = String(o.tokenAddress ?? "").trim();
        if (tokenAddress) candidates.push({ chainId, tokenAddress });
      }
    } catch {
      // ignore
    }
  }

  const uniq = Array.from(new Map(candidates.map((c) => [c.tokenAddress, c])).values())
    .slice(0, Math.max(limit * 3, 60));
  if (uniq.length === 0) return [];

  const out: TrendingTokenRow[] = [];
  const concurrency = 6;
  let i = 0;

  async function worker() {
    while (i < uniq.length && out.length < limit) {
      const idx = i++;
      const tokenAddress = uniq[idx]!.tokenAddress;
      try {
        const json = (await fetchJson(
          `https://api.dexscreener.com/token-pairs/v1/solana/${encodeURIComponent(tokenAddress)}`
        )) as { value?: unknown };
        const pairsRaw = Array.isArray(json?.value) ? (json.value as unknown[]) : [];
        if (pairsRaw.length === 0) continue;

        let best: Record<string, unknown> | null = null;
        let bestScore = -1;
        for (const p of pairsRaw) {
          if (!p || typeof p !== "object") continue;
          const o = p as Record<string, unknown>;
          const liqUsd = asNum((o.liquidity as any)?.usd);
          const volTf = asNum((o.volume as any)?.[timeKey]);
          const txnsTf = asNum((o.txns as any)?.[timeKey]?.buys) + asNum((o.txns as any)?.[timeKey]?.sells);
          // “Trending-like” heuristic: require some liquidity and activity.
          if (liqUsd < 25_000) continue;
          if (volTf < 50_000) continue;
          if (txnsTf < 25) continue;
          const score = liqUsd * 10 + volTf + txnsTf * 1000;
          if (score > bestScore) {
            bestScore = score;
            best = o;
          }
        }
        if (!best) continue;

        const base = (best.baseToken as any) ?? {};
        const symbol = String(base.symbol ?? "").trim();
        const mint = String(base.address ?? "").trim();
        if (!symbol || !mint) continue;

        out.push({
          symbol,
          mint,
          priceUsd: asNum(best.priceUsd),
          changePct: asNum((best.priceChange as any)?.[timeKey]),
          liquidityUsd: asNum((best.liquidity as any)?.usd),
          volumeUsd: asNum((best.volume as any)?.[timeKey]),
          holders: 0,
          source: "Dexscreener",
          timeframe: tf,
        });
      } catch {
        // ignore per-token failures
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return out;
}

async function loadDexscreener(tf: Timeframe, limit: number): Promise<TrendingTokenRow[]> {
  const top = (await fetchJson(
    `https://api.dexscreener.com/token-boosts/top/v1?limit=${encodeURIComponent(String(limit))}`
  )) as { value?: unknown };
  const rowsRaw = Array.isArray(top?.value) ? (top.value as unknown[]) : [];
  const addrs: string[] = [];
  for (const r of rowsRaw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (String(o.chainId ?? "").toLowerCase() !== "solana") continue;
    const addr = String(o.tokenAddress ?? "").trim();
    if (addr) addrs.push(addr);
  }
  const uniq = Array.from(new Set(addrs)).slice(0, limit);
  if (uniq.length === 0) return await loadDexscreenerHeuristic(tf, limit);

  const timeKey = pickTimeKey(tf);
  const out: TrendingTokenRow[] = [];

  // Keep concurrency modest to avoid public API throttling.
  const concurrency = 6;
  let i = 0;
  async function worker() {
    while (i < uniq.length) {
      const idx = i++;
      const tokenAddress = uniq[idx]!;
      try {
        const json = (await fetchJson(
          `https://api.dexscreener.com/token-pairs/v1/solana/${encodeURIComponent(tokenAddress)}`
        )) as { value?: unknown };
        const pairsRaw = Array.isArray(json?.value) ? (json.value as unknown[]) : [];
        if (pairsRaw.length === 0) continue;

        // Pick most relevant pair: highest liquidity.usd then highest volume in timeframe.
        let best: Record<string, unknown> | null = null;
        let bestScore = -1;
        for (const p of pairsRaw) {
          if (!p || typeof p !== "object") continue;
          const o = p as Record<string, unknown>;
          const liqUsd = asNum((o.liquidity as any)?.usd);
          const volTf = asNum((o.volume as any)?.[timeKey]);
          const score = liqUsd * 1_000_000 + volTf;
          if (score > bestScore) {
            bestScore = score;
            best = o;
          }
        }
        if (!best) continue;

        const base = (best.baseToken as any) ?? {};
        const symbol = String(base.symbol ?? "").trim();
        const mint = String(base.address ?? "").trim();
        if (!symbol || !mint) continue;

        out.push({
          symbol,
          mint,
          priceUsd: asNum(best.priceUsd),
          changePct: asNum((best.priceChange as any)?.[timeKey]),
          liquidityUsd: asNum((best.liquidity as any)?.usd),
          volumeUsd: asNum((best.volume as any)?.[timeKey]),
          holders: 0,
          source: "Dexscreener",
          timeframe: tf,
        });
      } catch {
        // Ignore per-token failures.
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  if (out.length === 0) {
    return await loadDexscreenerHeuristic(tf, limit);
  }
  return out;
}

async function loadGmgn(tf: Timeframe, limit: number): Promise<TrendingTokenRow[]> {
  // GMGN is often protected (Cloudflare). This adapter is best-effort: if blocked, return empty.
  const period = tf === "5m" ? "5m" : tf === "24h" ? "24h" : "1h";
  const url = `https://gmgn.ai/defi/quotation/v1/rank/sol/swaps/${encodeURIComponent(period)}?orderby=volume&direction=desc`;
  const json = (await fetchJson(url)) as Record<string, unknown>;
  const data = (json.data as any) ?? (json as any);
  const list = Array.isArray((data as any).rank) ? (data as any).rank : Array.isArray((data as any).data) ? (data as any).data : Array.isArray((data as any).list) ? (data as any).list : [];
  if (!Array.isArray(list)) return [];
  const out: TrendingTokenRow[] = [];
  for (const item of list.slice(0, limit)) {
    if (!item || typeof item !== "object") continue;
    const o = item as any;
    const mint = String(o.address ?? o.mint ?? o.contract_address ?? "").trim();
    const symbol = String(o.symbol ?? "").trim();
    if (!mint || !symbol) continue;
    out.push({
      symbol,
      mint,
      priceUsd: asNum(o.price ?? o.priceUsd ?? o.price_usd),
      changePct: asNum(o.change ?? o.changePct ?? o.price_change_percentage),
      liquidityUsd: asNum(o.liquidity ?? o.liquidityUsd ?? o.liq),
      volumeUsd: asNum(o.volume ?? o.volumeUsd ?? o.vol),
      holders: Math.max(0, Math.floor(asNum(o.holder_count ?? o.holders ?? 0))),
      source: "GMGN",
      timeframe: tf,
    });
  }
  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const timeframe = clampTimeframe(searchParams.get("timeframe"));
  const source = clampSource(searchParams.get("source"));

  const cacheKey = `${timeframe}:${source}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return Response.json(hit.payload, {
      headers: {
        "cache-control": "no-store",
      },
    });
  }

  const limit = 24;
  const tasks: Array<{ name: Exclude<Source, "All">; p: Promise<TrendingTokenRow[]> }> = [];

  if (source === "All" || source === "Dexscreener") tasks.push({ name: "Dexscreener", p: loadDexscreener(timeframe, limit) });
  if (source === "All" || source === "GMGN") tasks.push({ name: "GMGN", p: loadGmgn(timeframe, limit) });
  // Placeholders for future adapters:
  // - CoinGecko trending doesn’t include Solana mint addresses; needs extra mapping step.
  // - Axiom/Padre often require authenticated or blocked endpoints.

  const settled = await Promise.allSettled(tasks.map((t) => t.p));
  const merged: TrendingTokenRow[] = [];
  const health: Record<string, { ok: boolean; count: number; error?: string }> = {};
  for (let i = 0; i < settled.length; i++) {
    const name = tasks[i]!.name;
    const s = settled[i]!;
    if (s.status === "fulfilled") {
      merged.push(...s.value);
      health[name] = { ok: true, count: s.value.length };
    } else {
      health[name] = { ok: false, count: 0, error: String(s.reason?.message ?? s.reason ?? "failed") };
    }
  }

  // If a specific source was requested, filter to it.
  const rows =
    source === "All"
      ? merged
      : merged.filter((r) => r.source === source);

  // De-dupe by mint, keep highest volume for timeframe.
  const byMint = new Map<string, TrendingTokenRow>();
  for (const r of rows) {
    const key = r.mint;
    const prev = byMint.get(key);
    if (!prev || r.volumeUsd > prev.volumeUsd) byMint.set(key, r);
  }
  const finalRows = Array.from(byMint.values())
    .sort((a, b) => b.volumeUsd - a.volumeUsd)
    .slice(0, limit);

  const payload = { rows: finalRows, health };
  cache.set(cacheKey, { at: Date.now(), payload });

  return Response.json(payload, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
