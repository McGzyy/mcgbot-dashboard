const WSOL_MINT = "So11111111111111111111111111111111111111112";

/**
 * SOL / USD from Jupiter Price API (best-effort; falls back across endpoints).
 */
export async function fetchSolUsd(): Promise<number | null> {
  const urls = [
    `https://api.jup.ag/price/v2?ids=${WSOL_MINT}`,
    `https://lite-api.jup.ag/price/v2?ids=${WSOL_MINT}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store", next: { revalidate: 0 } });
      if (!res.ok) continue;
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!json) continue;

      const data = json.data as Record<string, { price?: string | number }> | undefined;
      const row = data?.[WSOL_MINT];
      const raw = row?.price;
      const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
      if (Number.isFinite(n) && n > 0) return n;
    } catch {
      /* try next */
    }
  }
  return null;
}
