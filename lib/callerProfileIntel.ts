import {
  aggregateCallPerformanceRows,
  filterRowsByCallTimeWindow,
  rankTopN,
  rowCallTimeUtcMs,
} from "@/lib/callPerformanceLeaderboard";
import { rowAthMultiple } from "@/lib/callPerformanceMultiples";
import {
  computeActiveDaysStreakUtc,
  computeMedianX,
} from "@/lib/callPerformanceUserStats";
import { filterCallRowsForStats } from "@/lib/statsCutover";
import { isCallPerformanceRowEligibleForStats } from "@/lib/callPerformanceDashboardVisibility";
import { rollingSevenDaysStartUtcMs } from "@/lib/leaderboardTimeWindows";

const DAY_MS = 86_400_000;

export type CallerIntelWindow = {
  calls: number;
  avgX: number;
  medianX: number;
  winRatePct: number;
  hit2xPct: number;
  hit5xPct: number;
  bestX: number;
  rank: number | null;
  rankedCallers: number;
};

export type CallerProfileIntel = {
  windows: {
    d7: CallerIntelWindow;
    d30: CallerIntelWindow;
    all: CallerIntelWindow;
  };
  activeDaysStreak: number;
  bestCall30d: {
    symbol: string;
    callCa: string;
    multiple: number;
    callTimeIso: string;
  } | null;
  vsDesk: {
    d7: { deskAvgX: number; callerAvgX: number; deltaPct: number } | null;
    d30: { deskAvgX: number; callerAvgX: number; deltaPct: number } | null;
  };
};

function rowSymbol(row: Record<string, unknown>): string {
  const tt = row.token_ticker;
  const tn = row.token_name;
  if (typeof tt === "string" && tt.trim()) return tt.trim().toUpperCase().slice(0, 14);
  if (typeof tn === "string" && tn.trim()) return tn.trim().slice(0, 14);
  const ca = typeof row.call_ca === "string" ? row.call_ca.trim() : "";
  return ca ? ca.slice(0, 4).toUpperCase() : "—";
}

function memberRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.filter((r) => {
    if (!isCallPerformanceRowEligibleForStats(r)) return false;
    const sourceRaw = typeof r.source === "string" ? r.source : "user";
    return String(sourceRaw).trim().toLowerCase() !== "bot";
  });
}

function windowStatsForUser(
  userRows: Record<string, unknown>[],
  discordId: string,
  minMs: number,
  nowMs: number,
  deskMemberRows: Record<string, unknown>[]
): CallerIntelWindow {
  const empty: CallerIntelWindow = {
    calls: 0,
    avgX: 0,
    medianX: 0,
    winRatePct: 0,
    hit2xPct: 0,
    hit5xPct: 0,
    bestX: 0,
    rank: null,
    rankedCallers: 0,
  };

  const inWindow = filterRowsByCallTimeWindow(userRows, minMs, nowMs);
  const userCalls = inWindow.filter((r) => {
    const id =
      typeof r.discord_id === "string"
        ? r.discord_id.trim()
        : String(r.discord_id ?? "").trim();
    if (id !== discordId) return false;
    const sourceRaw = typeof r.source === "string" ? r.source : "user";
    return String(sourceRaw).trim().toLowerCase() !== "bot";
  });

  if (userCalls.length === 0) return empty;

  const multiples: number[] = [];
  let hits2x = 0;
  let hits5x = 0;
  let bestX = 0;

  for (const r of userCalls) {
    const mult = rowAthMultiple(r);
    if (mult <= 0) continue;
    multiples.push(mult);
    if (mult >= 2) hits2x += 1;
    if (mult >= 5) hits5x += 1;
    if (mult > bestX) bestX = mult;
  }

  const n = multiples.length;
  if (n === 0) return empty;

  const sum = multiples.reduce((a, b) => a + b, 0);
  const winRatePct = (hits2x / n) * 100;

  const deskInWindow = filterRowsByCallTimeWindow(deskMemberRows, minMs, nowMs);
  const ranked = rankTopN(aggregateCallPerformanceRows(deskInWindow), deskInWindow.length);
  const idx = ranked.findIndex((u) => u.discordId === discordId);
  const rank = idx >= 0 ? idx + 1 : null;

  return {
    calls: n,
    avgX: sum / n,
    medianX: computeMedianX(userCalls),
    winRatePct,
    hit2xPct: (hits2x / n) * 100,
    hit5xPct: (hits5x / n) * 100,
    bestX,
    rank,
    rankedCallers: ranked.length,
  };
}

function deskAvgX(rows: Record<string, unknown>[], minMs: number, nowMs: number): number {
  const windowRows = filterRowsByCallTimeWindow(memberRows(rows), minMs, nowMs);
  if (windowRows.length === 0) return 0;
  let sum = 0;
  let n = 0;
  for (const r of windowRows) {
    const mult = rowAthMultiple(r);
    if (mult <= 0) continue;
    sum += mult;
    n += 1;
  }
  return n > 0 ? sum / n : 0;
}

function vsDeskDelta(callerAvgX: number, deskAvgXVal: number): number | null {
  if (callerAvgX <= 0 || deskAvgXVal <= 0) return null;
  return ((callerAvgX - deskAvgXVal) / deskAvgXVal) * 100;
}

function bestCallInWindow(
  userRows: Record<string, unknown>[],
  discordId: string,
  minMs: number,
  nowMs: number
): CallerProfileIntel["bestCall30d"] {
  const inWindow = filterRowsByCallTimeWindow(userRows, minMs, nowMs);
  let best: { row: Record<string, unknown>; mult: number } | null = null;

  for (const r of inWindow) {
    const id =
      typeof r.discord_id === "string"
        ? r.discord_id.trim()
        : String(r.discord_id ?? "").trim();
    if (id !== discordId) continue;
    const mult = rowAthMultiple(r);
    if (mult <= 0) continue;
    if (!best || mult > best.mult) best = { row: r, mult };
  }

  if (!best) return null;
  const tMs = rowCallTimeUtcMs(best.row);
  return {
    symbol: rowSymbol(best.row),
    callCa:
      typeof best.row.call_ca === "string"
        ? best.row.call_ca.trim()
        : String(best.row.call_ca ?? "").trim(),
    multiple: best.mult,
    callTimeIso: tMs > 0 ? new Date(tMs).toISOString() : "",
  };
}

export function buildCallerProfileIntel(
  rawUserRows: Record<string, unknown>[],
  cutoverMs: number | null,
  discordId: string,
  deskRowsForComparison: Record<string, unknown>[] | null,
  nowMs: number = Date.now()
): CallerProfileIntel {
  const userRows = filterCallRowsForStats(rawUserRows, cutoverMs);
  const deskRows = deskRowsForComparison
    ? filterCallRowsForStats(deskRowsForComparison, cutoverMs)
    : [];

  const min7 = rollingSevenDaysStartUtcMs(nowMs);
  const min30 = nowMs - 30 * DAY_MS;
  const minAll = 0;

  const d7 = windowStatsForUser(userRows, discordId, min7, nowMs, deskRows);
  const d30 = windowStatsForUser(userRows, discordId, min30, nowMs, deskRows);
  const all = windowStatsForUser(userRows, discordId, minAll, nowMs, deskRows);

  const desk7 = deskRows.length > 0 ? deskAvgX(deskRows, min7, nowMs) : 0;
  const desk30 = deskRows.length > 0 ? deskAvgX(deskRows, min30, nowMs) : 0;

  return {
    windows: { d7, d30, all },
    activeDaysStreak: computeActiveDaysStreakUtc(userRows, nowMs),
    bestCall30d: bestCallInWindow(userRows, discordId, min30, nowMs),
    vsDesk: {
      d7:
        d7.calls > 0 && desk7 > 0
          ? {
              deskAvgX: desk7,
              callerAvgX: d7.avgX,
              deltaPct: vsDeskDelta(d7.avgX, desk7) ?? 0,
            }
          : null,
      d30:
        d30.calls > 0 && desk30 > 0
          ? {
              deskAvgX: desk30,
              callerAvgX: d30.avgX,
              deltaPct: vsDeskDelta(d30.avgX, desk30) ?? 0,
            }
          : null,
    },
  };
}
