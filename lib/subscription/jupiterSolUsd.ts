const WSOL_MINT = "So11111111111111111111111111111111111111112";

const DEFAULT_TIMEOUT_MS = 3500;

async function fetchJson(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      next: { revalidate: 0 },
      signal: ctrl.signal,
      headers: {
        // Some providers are picky about UA; keep it simple.
        "Accept": "application/json",
      },
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function coercePositiveNumber(raw: unknown): number | null {
  const n =
    typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * SOL / USD (best-effort).
 *
 * Providers (in order):
 * - CoinGecko (no key; generally very reliable)
 * - Jupiter lite v2 (legacy; may be rate limited / deprecated)
 * - Jupiter v3 (requires x-api-key; optional)
 */
export async function fetchSolUsd(): Promise<number | null> {
  // 1) CoinGecko (simple price)
  {
    const json = (await fetchJson(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    )) as { solana?: { usd?: unknown } } | null;
    const n = coercePositiveNumber(json?.solana?.usd);
    if (n != null) return n;
  }

  // 2) Jupiter lite v2 (legacy)
  {
    const json = (await fetchJson(
      `https://lite-api.jup.ag/price/v2?ids=${WSOL_MINT}`
    )) as { data?: Record<string, { price?: unknown }> } | null;
    const n = coercePositiveNumber(json?.data?.[WSOL_MINT]?.price);
    if (n != null) return n;
  }

  // 3) Jupiter v3 (requires API key)
  {
    const key = (process.env.JUPITER_API_KEY ?? "").trim();
    if (!key) return null;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(`https://api.jup.ag/price/v3?ids=${WSOL_MINT}`, {
        cache: "no-store",
        next: { revalidate: 0 },
        signal: ctrl.signal,
        headers: { "Accept": "application/json", "x-api-key": key },
      });
      if (!res.ok) return null;
      const json = (await res.json().catch(() => null)) as { data?: Record<string, { price?: unknown }> } | null;
      const n = coercePositiveNumber(json?.data?.[WSOL_MINT]?.price);
      if (n != null) return n;
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  return null;
}
