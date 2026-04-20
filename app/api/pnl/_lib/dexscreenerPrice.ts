export async function fetchPricePerTokenSol(tokenCa: string): Promise<number | null> {
  const ca = tokenCa.trim();
  if (!ca) return null;
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(ca)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as any;
    const pairs = Array.isArray(json?.pairs) ? json.pairs : [];
    // Prefer SOL-quoted pairs.
    const solPairs = pairs.filter((p: any) => String(p?.quoteToken?.symbol ?? "").toUpperCase() === "SOL");
    const best = (solPairs.length ? solPairs : pairs).sort((a: any, b: any) => {
      const la = Number(a?.liquidity?.usd ?? 0);
      const lb = Number(b?.liquidity?.usd ?? 0);
      return lb - la;
    })[0];
    if (!best) return null;
    const priceNative = Number(best.priceNative);
    if (Number.isFinite(priceNative) && priceNative > 0) return priceNative;
    return null;
  } catch {
    return null;
  }
}

