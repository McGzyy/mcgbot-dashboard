export const runtime = "nodejs";

const CACHE_TTL_MS = 25_000;
const FETCH_TIMEOUT_MS = 14_000;

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

type DebugInfo = {
  timeframe: Timeframe;
  source: Source;
  dexscreener: {
    boostsSeen: number;
    heuristicCandidatesSeen: number;
    tokenPairsFetched: number;
    tokenPairsMatched: number;
  };
  gmgn: {
    rowsSeen: number;
  };
};

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

/** Dex endpoints vary: bare arrays vs `{ value }` vs `{ pairs }`. */
function extractDexArray(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  for (const key of ["value", "pairs", "data", "items", "results"]) {
    const v = o[key];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function pairsFromLatestDexTokens(json: unknown): Record<string, unknown>[] {
  if (!json || typeof json !== "object") return [];
  const pairs = (json as Record<string, unknown>).pairs;
  return Array.isArray(pairs) ? (pairs as Record<string, unknown>[]) : [];
}

function chunkStrings<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchLatestDexPairsForMints(mints: string[], dbg?: DebugInfo): Promise<Record<string, unknown>[]> {
  const uniq = Array.from(new Set(mints.map((m) => m.trim()).filter(Boolean)));
  const merged: Record<string, unknown>[] = [];

  for (const group of chunkStrings(uniq, 20)) {
    try {
      if (dbg) dbg.dexscreener.tokenPairsFetched += 1;
      const url = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(group.join(","))}`;
      const json = await fetchJson(url);
      const pairs = pairsFromLatestDexTokens(json);
      if (pairs.length > 0) {
        merged.push(...pairs);
        continue;
      }
    } catch {
      /* fall through to per-mint */
    }

    for (const m of group) {
      try {
        if (dbg) dbg.dexscreener.tokenPairsFetched += 1;
        const json = await fetchJson(
          `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(m)}`
        );
        merged.push(...pairsFromLatestDexTokens(json));
      } catch {
        /* ignore */
      }
    }
  }

  return merged;
}

function pickBestPairForMint(
  mint: string,
  pairs: Record<string, unknown>[],
  timeKey: "m5" | "h1" | "h24",
  opts?: { minLiqUsd?: number; minVolUsd?: number; minTxns?: number }
): Record<string, unknown> | null {
  let best: Record<string, unknown> | null = null;
  let bestScore = -1;
  const focus = mint.trim();
  if (!focus) return null;

  for (const p of pairs) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    if (String(o.chainId ?? "").toLowerCase() !== "solana") continue;

    const base = (o.baseToken as Record<string, unknown>) ?? {};
    const quote = (o.quoteToken as Record<string, unknown>) ?? {};
    const bA = typeof base.address === "string" ? base.address.trim() : "";
    const qA = typeof quote.address === "string" ? quote.address.trim() : "";
    if (bA !== focus && qA !== focus) continue;

    const liqUsd = asNum((o.liquidity as { usd?: unknown })?.usd);
    const volTf = asNum((o.volume as Record<string, unknown> | undefined)?.[timeKey]);
    const txBucket =
      o.txns && typeof o.txns === "object"
        ? ((o.txns as Record<string, unknown>)[timeKey] as Record<string, unknown> | undefined)
        : undefined;
    const txnsTf =
      txBucket && typeof txBucket === "object"
        ? asNum(txBucket.buys) + asNum(txBucket.sells)
        : 0;

    if (opts?.minLiqUsd != null && liqUsd < opts.minLiqUsd) continue;
    if (opts?.minVolUsd != null && volTf < opts.minVolUsd) continue;
    if (opts?.minTxns != null && txnsTf < opts.minTxns) continue;

    const score = liqUsd * 4 + volTf + txnsTf * 650;
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }

  return best;
}

function trendingRowFromPair(
  pair: Record<string, unknown>,
  mintFocus: string,
  tf: Timeframe
): TrendingTokenRow | null {
  const timeKey = pickTimeKey(tf);
  const focus = mintFocus.trim();
  const base = (pair.baseToken as Record<string, unknown>) ?? {};
  const quote = (pair.quoteToken as Record<string, unknown>) ?? {};
  const bA = typeof base.address === "string" ? base.address.trim() : "";
  const qA = typeof quote.address === "string" ? quote.address.trim() : "";

  let symbol = "";
  if (bA === focus) symbol = typeof base.symbol === "string" ? base.symbol.trim() : "";
  else if (qA === focus) symbol = typeof quote.symbol === "string" ? quote.symbol.trim() : "";
  if (!symbol) symbol = focus.slice(0, 6) || "?";

  const mint = focus;
  if (!mint) return null;

  return {
    symbol,
    mint,
    priceUsd: asNum(pair.priceUsd),
    changePct: asNum((pair.priceChange as Record<string, unknown> | undefined)?.[timeKey]),
    liquidityUsd: asNum((pair.liquidity as { usd?: unknown })?.usd),
    volumeUsd: asNum((pair.volume as Record<string, unknown> | undefined)?.[timeKey]),
    holders: 0,
    source: "Dexscreener",
    timeframe: tf,
  };
}

async function loadDexscreenerHeuristic(
  tf: Timeframe,
  limit: number,
  dbg?: DebugInfo
): Promise<TrendingTokenRow[]> {
  const timeKey = pickTimeKey(tf);
  const minLiqUsd = tf === "5m" ? 7_500 : tf === "24h" ? 25_000 : 12_500;
  const minVolUsd = tf === "5m" ? 4_000 : tf === "24h" ? 60_000 : 12_000;
  const minTxns = tf === "5m" ? 8 : tf === "24h" ? 25 : 12;
  const candidates: Array<{ chainId: string; tokenAddress: string }> = [];

  const sources = [
    "https://api.dexscreener.com/token-profiles/latest/v1",
    "https://api.dexscreener.com/token-profiles/recent-updates/v1",
  ];

  for (const url of sources) {
    try {
      const json = (await fetchJson(url)) as any;
      const arr = extractDexArray(json);
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

  if (dbg) dbg.dexscreener.heuristicCandidatesSeen += candidates.length;

  const uniq = Array.from(new Map(candidates.map((c) => [c.tokenAddress, c])).values())
    .slice(0, Math.max(limit * 3, 60));
  if (uniq.length === 0) return [];

  const out: TrendingTokenRow[] = [];
  const mints = uniq.map((c) => c.tokenAddress);
  const allPairs = await fetchLatestDexPairsForMints(mints, dbg);

  for (const c of uniq) {
    if (out.length >= limit) break;
    const best = pickBestPairForMint(c.tokenAddress, allPairs, timeKey, {
      minLiqUsd,
      minVolUsd,
      minTxns,
    });
    if (!best) continue;
    if (dbg) dbg.dexscreener.tokenPairsMatched += 1;
    const row = trendingRowFromPair(best, c.tokenAddress, tf);
    if (row) out.push(row);
  }

  return out;
}

async function loadDexscreener(
  tf: Timeframe,
  limit: number,
  dbg?: DebugInfo
): Promise<TrendingTokenRow[]> {
  const top = await fetchJson(
    `https://api.dexscreener.com/token-boosts/top/v1?limit=${encodeURIComponent(String(Math.max(limit, 40)))}`
  );
  const rowsRaw = extractDexArray(top);
  if (dbg) dbg.dexscreener.boostsSeen += rowsRaw.length;
  const addrs: string[] = [];
  for (const r of rowsRaw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (String(o.chainId ?? "").toLowerCase() !== "solana") continue;
    const addr = String(o.tokenAddress ?? "").trim();
    if (addr) addrs.push(addr);
  }
  const uniq = Array.from(new Set(addrs)).slice(0, Math.max(limit, 24));
  if (uniq.length === 0) return await loadDexscreenerHeuristic(tf, limit, dbg);

  const timeKey = pickTimeKey(tf);
  const out: TrendingTokenRow[] = [];
  const allPairs = await fetchLatestDexPairsForMints(uniq, dbg);

  for (const mint of uniq) {
    if (out.length >= limit) break;
    const best = pickBestPairForMint(mint, allPairs, timeKey);
    if (!best) continue;
    if (dbg) dbg.dexscreener.tokenPairsMatched += 1;
    const row = trendingRowFromPair(best, mint, tf);
    if (row) out.push(row);
  }

  if (out.length === 0) {
    return await loadDexscreenerHeuristic(tf, limit, dbg);
  }
  return out;
}

async function loadGmgn(tf: Timeframe, limit: number, dbg?: DebugInfo): Promise<TrendingTokenRow[]> {
  // GMGN is often protected (Cloudflare). This adapter is best-effort: if blocked, return empty.
  const period = tf === "5m" ? "5m" : tf === "24h" ? "24h" : "1h";
  const url = `https://gmgn.ai/defi/quotation/v1/rank/sol/swaps/${encodeURIComponent(period)}?orderby=volume&direction=desc`;
  const json = (await fetchJson(url)) as Record<string, unknown>;
  const data = (json.data as any) ?? (json as any);
  const list = Array.isArray((data as any).rank) ? (data as any).rank : Array.isArray((data as any).data) ? (data as any).data : Array.isArray((data as any).list) ? (data as any).list : [];
  if (!Array.isArray(list)) return [];
  const out: TrendingTokenRow[] = [];
  const sliced = list.slice(0, limit);
  if (dbg) dbg.gmgn.rowsSeen += sliced.length;
  for (const item of sliced) {
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
  const wantDebug = searchParams.get("debug") === "1";

  const dbg: DebugInfo = {
    timeframe,
    source,
    dexscreener: {
      boostsSeen: 0,
      heuristicCandidatesSeen: 0,
      tokenPairsFetched: 0,
      tokenPairsMatched: 0,
    },
    gmgn: { rowsSeen: 0 },
  };

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

  if (source === "All" || source === "Dexscreener")
    tasks.push({ name: "Dexscreener", p: loadDexscreener(timeframe, limit, dbg) });
  if (source === "All" || source === "GMGN")
    tasks.push({ name: "GMGN", p: loadGmgn(timeframe, limit, dbg) });
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

  const payload = wantDebug ? { rows: finalRows, health, debug: dbg } : { rows: finalRows, health };
  cache.set(cacheKey, { at: Date.now(), payload });

  return Response.json(payload, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
