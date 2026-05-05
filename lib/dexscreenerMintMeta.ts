const FETCH_TIMEOUT_MS = 10_000;
const CACHE_MS = 120_000;

export type MintMetaResult = {
  mint: string;
  found: boolean;
  symbol: string | null;
  name: string | null;
  imageUrl: string | null;
};

type CacheEntry = { at: number; payload: MintMetaResult };
const cache = new Map<string, CacheEntry>();

export function normalizeDexscreenerMint(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.length < 20 || s.length > 60) return null;
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) return null;
  return s;
}

async function fetchJsonNode(url: string): Promise<unknown> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: ac.signal,
      headers: {
        accept: "application/json",
        "user-agent": "mcgbot-dashboard/1.0 (+https://mcgbot.xyz)",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function pickTokenFromPair(pair: Record<string, unknown>, mint: string): {
  name: string;
  symbol: string;
  imageUrl: string | null;
} | null {
  const base = pair.baseToken as Record<string, unknown> | undefined;
  const quote = pair.quoteToken as Record<string, unknown> | undefined;
  const bAddr = typeof base?.address === "string" ? base.address.trim() : "";
  const qAddr = typeof quote?.address === "string" ? quote.address.trim() : "";
  const side = bAddr === mint ? base : qAddr === mint ? quote : bAddr ? base : null;
  if (!side) return null;
  const name = typeof side.name === "string" ? side.name.trim() : "";
  const symbol = typeof side.symbol === "string" ? side.symbol.trim() : "";
  const info = pair.info as Record<string, unknown> | undefined;
  const imgFromInfo = typeof info?.imageUrl === "string" ? info.imageUrl.trim() : "";
  const imgFromSide = typeof side.imageUrl === "string" ? side.imageUrl.trim() : "";
  const imageUrl = imgFromInfo || imgFromSide || null;
  return {
    name: name || symbol || "Unknown",
    symbol: symbol || "???",
    imageUrl: imageUrl || null,
  };
}

/**
 * DexScreener token metadata for a Solana mint (cached in-process).
 */
export async function fetchDexscreenerMintMeta(mint: string): Promise<MintMetaResult> {
  const normalized = normalizeDexscreenerMint(mint);
  if (!normalized) {
    return { mint: mint.trim(), found: false, symbol: null, name: null, imageUrl: null };
  }

  const cached = cache.get(normalized);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.payload;
  }

  try {
    const apiUrl = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(normalized)}`;
    const json = (await fetchJsonNode(apiUrl)) as Record<string, unknown>;
    const pairsRaw = json.pairs;
    const pairs = Array.isArray(pairsRaw) ? (pairsRaw as Record<string, unknown>[]) : [];

    let picked: { name: string; symbol: string; imageUrl: string | null } | null = null;

    for (const p of pairs) {
      if (!p || typeof p !== "object") continue;
      if (String(p.chainId || "").toLowerCase() !== "solana") continue;
      const t = pickTokenFromPair(p, normalized);
      if (t) {
        picked = t;
        break;
      }
    }

    if (!picked) {
      const p0 = pairs.find((x) => String((x as Record<string, unknown>)?.chainId || "").toLowerCase() === "solana");
      if (p0 && typeof p0 === "object") {
        const base = (p0 as Record<string, unknown>).baseToken as Record<string, unknown> | undefined;
        if (base && String(base.address) === normalized) {
          const info = (p0 as Record<string, unknown>).info as Record<string, unknown> | undefined;
          const img =
            (typeof info?.imageUrl === "string" && info.imageUrl.trim()) ||
            (typeof base.imageUrl === "string" && base.imageUrl.trim()) ||
            null;
          picked = {
            name: typeof base.name === "string" && base.name.trim() ? base.name.trim() : "Unknown",
            symbol: typeof base.symbol === "string" && base.symbol.trim() ? base.symbol.trim() : "???",
            imageUrl: img,
          };
        }
      }
    }

    const payload: MintMetaResult = picked
      ? {
          mint: normalized,
          found: true,
          symbol: picked.symbol,
          name: picked.name,
          imageUrl: picked.imageUrl,
        }
      : { mint: normalized, found: false, symbol: null, name: null, imageUrl: null };

    cache.set(normalized, { at: Date.now(), payload });
    return payload;
  } catch {
    const miss: MintMetaResult = { mint: normalized, found: false, symbol: null, name: null, imageUrl: null };
    cache.set(normalized, { at: Date.now(), payload: miss });
    return miss;
  }
}

/** Resolve many mints with bounded concurrency (DexScreener rate limits). */
export async function fetchDexscreenerMintMetaBatch(
  mints: string[],
  opts?: { concurrency?: number; maxMints?: number }
): Promise<Map<string, MintMetaResult>> {
  const concurrency = Math.max(1, Math.min(6, opts?.concurrency ?? 4));
  const maxMints = Math.max(1, opts?.maxMints ?? 28);
  const seen = new Set<string>();
  const list: string[] = [];
  for (const m of mints) {
    const n = normalizeDexscreenerMint(m);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    list.push(n);
    if (list.length >= maxMints) break;
  }

  const out = new Map<string, MintMetaResult>();
  for (let offset = 0; offset < list.length; offset += concurrency) {
    const chunk = list.slice(offset, offset + concurrency);
    const metas = await Promise.all(chunk.map((mint) => fetchDexscreenerMintMeta(mint)));
    for (const meta of metas) {
      out.set(meta.mint, meta);
    }
  }
  return out;
}
