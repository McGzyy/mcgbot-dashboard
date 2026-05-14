import type { SupabaseClient } from "@supabase/supabase-js";

export type OutsideSourceCallStats = {
  primary_call_count: number;
  avg_peak_multiple: number | null;
};

/**
 * Loads per-source aggregates from `outside_x_source_call_stats` (see migration).
 * Returns empty values for ids missing from the view (no calls yet).
 */
export async function fetchOutsideSourceCallStatsMap(
  db: SupabaseClient,
  sourceIds: string[]
): Promise<Map<string, OutsideSourceCallStats>> {
  const map = new Map<string, OutsideSourceCallStats>();
  const ids = [...new Set(sourceIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return map;

  const { data, error } = await db
    .from("outside_x_source_call_stats")
    .select("source_id, primary_call_count, avg_peak_multiple")
    .in("source_id", ids);

  if (error) {
    console.error("[outside_x_source_call_stats]", error);
    return map;
  }

  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const sid = typeof r.source_id === "string" ? r.source_id.trim() : "";
    if (!sid) continue;
    const pcRaw = r.primary_call_count;
    const pcN = typeof pcRaw === "number" ? pcRaw : typeof pcRaw === "string" ? Number(pcRaw) : NaN;
    const pc = Number.isFinite(pcN) ? Math.trunc(pcN) : 0;
    const avRaw = r.avg_peak_multiple;
    let avgPeak: number | null = null;
    if (typeof avRaw === "number" && Number.isFinite(avRaw) && avRaw > 0) {
      avgPeak = avRaw;
    } else if (typeof avRaw === "string") {
      const n = Number(avRaw);
      if (Number.isFinite(n) && n > 0) avgPeak = n;
    }
    map.set(sid, { primary_call_count: pc, avg_peak_multiple: avgPeak });
  }
  return map;
}

export function mergeOutsideSourceCallStats<T extends { id: string }>(
  sources: T[],
  stats: Map<string, OutsideSourceCallStats>
): Array<T & OutsideSourceCallStats> {
  return sources.map((s) => {
    const st = stats.get(s.id);
    return {
      ...s,
      primary_call_count: st?.primary_call_count ?? 0,
      avg_peak_multiple: st?.avg_peak_multiple ?? null,
    };
  });
}
