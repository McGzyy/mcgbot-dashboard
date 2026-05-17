import { clampAthMultipleForStats } from "@/lib/callPerformanceMultiples";
import { fetchDexscreenerMintMetaBatch } from "@/lib/dexscreenerMintMeta";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OutsideTapeMintMeta = {
  tokenName: string | null;
  tokenTicker: string | null;
  tokenImageUrl: string | null;
};

export type OutsideTapePerformance = {
  liveMultiple: number | null;
  athMultiple: number | null;
  entryMcapUsd: number | null;
};

/** Latest `call_performance` row per mint (any source) for live × display. */
export async function fetchLatestPerformanceByMint(
  db: SupabaseClient,
  mints: string[]
): Promise<Map<string, { liveMultiple: number | null; athMultiple: number | null }>> {
  const unique = [...new Set(mints.map((m) => m.trim()).filter(Boolean))];
  const out = new Map<string, { liveMultiple: number | null; athMultiple: number | null }>();
  if (!unique.length) return out;

  const { data, error } = await db
    .from("call_performance")
    .select("call_ca, spot_multiple, ath_multiple, call_time")
    .in("call_ca", unique.slice(0, 80))
    .order("call_time", { ascending: false });

  if (error || !Array.isArray(data)) return out;

  for (const row of data) {
    const ca = typeof row.call_ca === "string" ? row.call_ca.trim() : "";
    if (!ca || out.has(ca)) continue;
    const spot = Number(row.spot_multiple);
    const ath = Number(row.ath_multiple);
    out.set(ca, {
      liveMultiple:
        Number.isFinite(spot) && spot > 0 ? clampAthMultipleForStats(spot) : null,
      athMultiple: Number.isFinite(ath) && ath > 0 ? clampAthMultipleForStats(ath) : null,
    });
  }
  return out;
}

export async function fetchDexMetaByMint(mints: string[]): Promise<Map<string, OutsideTapeMintMeta>> {
  const batch = await fetchDexscreenerMintMetaBatch(mints, { maxMints: 40 });
  const out = new Map<string, OutsideTapeMintMeta>();
  for (const [mint, meta] of batch) {
    if (!meta.found) {
      out.set(mint, { tokenName: null, tokenTicker: null, tokenImageUrl: null });
      continue;
    }
    out.set(mint, {
      tokenName: meta.name,
      tokenTicker: meta.symbol,
      tokenImageUrl: meta.imageUrl,
    });
  }
  return out;
}
