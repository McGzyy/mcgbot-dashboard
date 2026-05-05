import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 10_000;
const CACHE_MS = 120_000;

type CacheEntry = { at: number; payload: Record<string, unknown> };
const cache = new Map<string, CacheEntry>();

function normalizeMint(raw: string | null): string | null {
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

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id?.trim()) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const mint = normalizeMint(url.searchParams.get("mint"));
    if (!mint) {
      return Response.json({ error: "Invalid mint" }, { status: 400 });
    }

    const cached = cache.get(mint);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return Response.json(cached.payload);
    }

    const apiUrl = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`;
    const json = (await fetchJsonNode(apiUrl)) as Record<string, unknown>;
    const pairsRaw = json.pairs;
    const pairs = Array.isArray(pairsRaw) ? (pairsRaw as Record<string, unknown>[]) : [];

    let picked: { name: string; symbol: string; imageUrl: string | null } | null = null;

    for (const p of pairs) {
      if (!p || typeof p !== "object") continue;
      if (String(p.chainId || "").toLowerCase() !== "solana") continue;
      const t = pickTokenFromPair(p, mint);
      if (t) {
        picked = t;
        break;
      }
    }

    if (!picked) {
      const p0 = pairs.find((x) => String((x as Record<string, unknown>)?.chainId || "").toLowerCase() === "solana");
      if (p0 && typeof p0 === "object") {
        const base = (p0 as Record<string, unknown>).baseToken as Record<string, unknown> | undefined;
        if (base && String(base.address) === mint) {
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

    if (!picked) {
      const payload = {
        ok: true as const,
        mint,
        found: false as const,
        symbol: null,
        name: null,
        imageUrl: null,
      };
      cache.set(mint, { at: Date.now(), payload });
      return Response.json(payload);
    }

    const payload = {
      ok: true as const,
      mint,
      found: true as const,
      symbol: picked.symbol,
      name: picked.name,
      imageUrl: picked.imageUrl,
    };
    cache.set(mint, { at: Date.now(), payload });
    return Response.json(payload);
  } catch (e) {
    console.error("[solana/mint-meta] GET:", e);
    return Response.json({ ok: false, error: "Lookup failed" }, { status: 502 });
  }
}
