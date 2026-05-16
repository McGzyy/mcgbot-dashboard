import {
  aggregateCallPerformanceRows,
  filterRowsByCallTimeWindow,
  rankTopN,
  type AggregatedLeader,
} from "@/lib/callPerformanceLeaderboard";
import { filterCallRowsForStats } from "@/lib/statsCutover";

const DAY_MS = 86_400_000;

export type DeskRankMover = {
  discordId: string;
  username: string;
  rankNow: number;
  rankPrior: number | null;
  /** Positive = moved up (lower rank number). Null prior = new in ranked set. */
  spotsUp: number | null;
  avgX: number;
  totalCalls: number;
};

function rankMap(aggregated: AggregatedLeader[]): Map<string, number> {
  const ranked = rankTopN(aggregated, aggregated.length);
  const m = new Map<string, number>();
  for (const u of ranked) {
    m.set(u.discordId, u.rank);
  }
  return m;
}

/** Callers who climbed the rolling-24h avg-X board vs the prior 24h window. */
export function buildDeskRankMovers(
  rawRows: Record<string, unknown>[],
  cutoverMs: number | null,
  currentMinMs: number,
  nowMs: number = Date.now(),
  limit = 5,
  excludeDiscordIds?: ReadonlySet<string>
): DeskRankMover[] {
  const rows = filterCallRowsForStats(rawRows, cutoverMs);
  const windowMs = Math.max(DAY_MS, nowMs - currentMinMs);
  const priorEndMs = nowMs - windowMs;
  const priorMinMs = Math.max(currentMinMs, priorEndMs - windowMs);

  const memberOnly = rows.filter((r) => {
    const sourceRaw = typeof r.source === "string" ? r.source : "user";
    return String(sourceRaw).trim().toLowerCase() !== "bot";
  });

  const currentRows = filterRowsByCallTimeWindow(memberOnly, currentMinMs, nowMs);
  const priorRows = filterRowsByCallTimeWindow(memberOnly, priorMinMs, priorEndMs);

  if (currentRows.length === 0) return [];

  const currentAgg = aggregateCallPerformanceRows(currentRows, excludeDiscordIds);
  const priorAgg = aggregateCallPerformanceRows(priorRows, excludeDiscordIds);
  const currentRanked = rankTopN(currentAgg, 30);
  const priorRanks = rankMap(priorAgg);

  const movers: DeskRankMover[] = [];

  for (const u of currentRanked) {
    if (u.totalCalls < 1) continue;
    const rankNow = u.rank;
    const rankPrior = priorRanks.get(u.discordId) ?? null;
    let spotsUp: number | null = null;
    if (rankPrior == null) {
      if (rankNow <= 10) spotsUp = null;
      else continue;
    } else {
      spotsUp = rankPrior - rankNow;
      if (spotsUp <= 0) continue;
    }

    movers.push({
      discordId: u.discordId,
      username: u.username,
      rankNow,
      rankPrior,
      spotsUp,
      avgX: u.avgX,
      totalCalls: u.totalCalls,
    });
  }

  movers.sort((a, b) => {
    const au = a.spotsUp ?? 100;
    const bu = b.spotsUp ?? 100;
    if (bu !== au) return bu - au;
    return a.rankNow - b.rankNow;
  });

  return movers.slice(0, limit);
}
