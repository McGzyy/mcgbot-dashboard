export type DexTimeframeKey = "5m" | "1h" | "6h" | "24h";

const TF_MAP: Record<DexTimeframeKey, string> = {
  "5m": "m5",
  "1h": "h1",
  "6h": "h6",
  "24h": "h24",
};

export type DexPairLite = {
  pairAddress: string;
  priceUsd: number | null;
  priceChangePct: number | null;
  marketCapUsd: number | null;
};

/**
 * Best-effort Dexscreener stats for a Solana mint (first liquid pair).
 */
export async function fetchDexMetricsForMint(
  mint: string,
  timeframe: DexTimeframeKey
): Promise<DexPairLite | null> {
  const m = mint.trim();
  if (!m) return null;
  const key = TF_MAP[timeframe];
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(m)}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const j = (await res.json().catch(() => null)) as {
      pairs?: Array<Record<string, unknown>>;
    } | null;
    const pairs = j && Array.isArray(j.pairs) ? j.pairs : [];
    const solPairs = pairs.filter((p) => {
      const chain = typeof p.chainId === "string" ? p.chainId : "";
      return chain === "solana";
    });
    const pick = (solPairs[0] ?? pairs[0]) as Record<string, unknown> | undefined;
    if (!pick) return null;
    const priceUsd = typeof pick.priceUsd === "string" ? Number(pick.priceUsd) : Number(pick.priceUsd);
    const fdv = typeof pick.fdv === "number" ? pick.fdv : Number(pick.fdv);
    const mc =
      typeof pick.marketCap === "number"
        ? pick.marketCap
        : typeof pick.marketCap === "string"
          ? Number(pick.marketCap)
          : Number.isFinite(fdv)
            ? fdv
            : null;
    const ch = pick.priceChange as Record<string, unknown> | undefined;
    const rawChange =
      ch && typeof ch[key] === "number"
        ? (ch[key] as number)
        : ch && typeof ch[key] === "string"
          ? Number(ch[key])
          : null;
    const priceChangePct =
      rawChange != null && Number.isFinite(rawChange) ? rawChange : null;
    const pairAddress = typeof pick.pairAddress === "string" ? pick.pairAddress : "";
    return {
      pairAddress,
      priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
      priceChangePct,
      marketCapUsd: mc != null && Number.isFinite(mc) ? mc : null,
    };
  } catch {
    return null;
  }
}

export function sizeTierFromUsd(usd: number | null): string {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return "?";
  if (usd < 100) return "S";
  if (usd < 2_500) return "M";
  if (usd < 50_000) return "L";
  return "XL";
}
