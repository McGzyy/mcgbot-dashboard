import {
  aggregateCallPerformanceRows,
  filterRowsByCallTimeWindow,
  rankTopN,
} from "@/lib/callPerformanceLeaderboard";
import { rowAthMultiple } from "@/lib/callPerformanceMultiples";
import { filterCallRowsForStats } from "@/lib/statsCutover";
import { isCallPerformanceRowEligibleForStats } from "@/lib/callPerformanceDashboardVisibility";

export type DeskYouStats = {
  calls: number;
  avgX: number;
  medianX: number;
  hits2xPlus: number;
  rank: number | null;
  totalRanked: number;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Viewer stats for the same rolling-24h desk window + rank among members. */
export function buildDeskYouStats(
  rawRows: Record<string, unknown>[],
  cutoverMs: number | null,
  viewerDiscordId: string,
  currentMinMs: number,
  nowMs: number = Date.now(),
  excludeDiscordIds?: ReadonlySet<string>
): DeskYouStats | null {
  const id = viewerDiscordId.trim();
  if (!id) return null;

  const rows = filterCallRowsForStats(rawRows, cutoverMs);
  const currentRows = filterRowsByCallTimeWindow(rows, currentMinMs, nowMs);

  const multiples: number[] = [];
  let hits2xPlus = 0;

  for (const r of currentRows) {
    if (!isCallPerformanceRowEligibleForStats(r)) continue;
    const discordId =
      typeof r.discord_id === "string"
        ? r.discord_id.trim()
        : String(r.discord_id ?? "").trim();
    if (discordId !== id) continue;

    const sourceRaw = typeof r.source === "string" ? r.source : "user";
    const source = String(sourceRaw).trim().toLowerCase() || "user";
    if (source === "bot") continue;

    const mult = rowAthMultiple(r);
    if (mult <= 0) continue;
    multiples.push(mult);
    if (mult >= 2) hits2xPlus += 1;
  }

  const n = multiples.length;
  const sum = multiples.reduce((a, b) => a + b, 0);

  const memberRows = currentRows.filter((r) => {
    const sourceRaw = typeof r.source === "string" ? r.source : "user";
    return String(sourceRaw).trim().toLowerCase() !== "bot";
  });
  const aggregated = aggregateCallPerformanceRows(memberRows, excludeDiscordIds);
  const ranked = rankTopN(aggregated, aggregated.length);
  const idx = ranked.findIndex((u) => u.discordId === id);
  const rank = idx >= 0 ? idx + 1 : null;

  return {
    calls: n,
    avgX: n > 0 ? sum / n : 0,
    medianX: n > 0 ? median(multiples) : 0,
    hits2xPlus,
    rank,
    totalRanked: ranked.length,
  };
}
