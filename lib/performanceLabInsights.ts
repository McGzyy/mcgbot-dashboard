import { rowCallTimeUtcMs } from "@/lib/callPerformanceLeaderboard";
import { rowAthMultiple } from "@/lib/callPerformanceMultiples";
import type { DailyCallBucket } from "@/lib/performanceSeries";
import type { MultipleDistribution } from "@/lib/performanceSeries";

export type PerformanceLabWindow = "7d" | "14d" | "30d";

const DAY_MS = 86_400_000;

export function performanceLabWindowDays(w: PerformanceLabWindow): number {
  return w === "7d" ? 7 : w === "30d" ? 30 : 14;
}

export type WindowStats = {
  calls: number;
  avgX: number;
  winRate: number;
  bestX: number;
};

export type PeriodCompare = {
  window: PerformanceLabWindow;
  current: WindowStats;
  prior: WindowStats;
  delta: {
    calls: number;
    avgX: number;
    winRate: number;
  };
};

function statsForRows(rows: Record<string, unknown>[]): WindowStats {
  let sum = 0;
  let n = 0;
  let wins = 0;
  let best = 0;
  for (const r of rows) {
    const m = rowAthMultiple(r);
    if (!Number.isFinite(m) || m <= 0) continue;
    n += 1;
    sum += m;
    if (m >= 2) wins += 1;
    if (m > best) best = m;
  }
  return {
    calls: n,
    avgX: n > 0 ? sum / n : 0,
    winRate: n > 0 ? (wins / n) * 100 : 0,
    bestX: best,
  };
}

function filterRowsInUtcWindow(
  rows: Record<string, unknown>[],
  startMs: number,
  endMs: number
): Record<string, unknown>[] {
  return rows.filter((r) => {
    const t = rowCallTimeUtcMs(r);
    return t > startMs && t <= endMs;
  });
}

export function computePeriodCompare(
  rows: Record<string, unknown>[],
  window: PerformanceLabWindow,
  nowMs: number
): PeriodCompare {
  const days = performanceLabWindowDays(window);
  const span = days * DAY_MS;
  const end = nowMs;
  const currentStart = end - span;
  const priorEnd = currentStart;
  const priorStart = priorEnd - span;

  const current = statsForRows(filterRowsInUtcWindow(rows, currentStart, end));
  const prior = statsForRows(filterRowsInUtcWindow(rows, priorStart, priorEnd));

  return {
    window,
    current,
    prior,
    delta: {
      calls: current.calls - prior.calls,
      avgX: current.avgX - prior.avgX,
      winRate: current.winRate - prior.winRate,
    },
  };
}

export type WeeklySummary = {
  headline: string;
  bullets: string[];
  copyText: string;
};

function fmtDelta(n: number, suffix = ""): string {
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return `±0${suffix}`;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(suffix === "%" ? 0 : 2)}${suffix}`;
}

export function buildWeeklySummary(input: {
  stats: {
    avgX: number;
    winRate: number;
    totalCalls: number;
    bestX30d: number;
    activeDaysStreak: number;
  };
  compare: PeriodCompare;
  rank7d: number | null;
  totalRanked7d: number;
  distribution: MultipleDistribution | undefined;
}): WeeklySummary {
  const { stats, compare, rank7d, totalRanked7d, distribution } = input;
  const w = compare.window;
  const days = performanceLabWindowDays(w);
  const rankLine =
    rank7d != null && totalRanked7d > 0
      ? `#${rank7d} of ${totalRanked7d} callers (7d board)`
      : "Unranked this week on the caller board";

  const fivePlus =
    distribution && distribution.total > 0
      ? Math.round((distribution.fivePlus / distribution.total) * 100)
      : null;

  const headline =
    compare.current.calls > 0
      ? `${compare.current.calls} call${compare.current.calls === 1 ? "" : "s"} · ${compare.current.avgX.toFixed(2)}× avg (last ${days}d UTC)`
      : `No calls in the last ${days} UTC days yet`;

  const bullets = [
    `Win rate ${stats.winRate.toFixed(0)}% lifetime · ${stats.totalCalls} total calls`,
    `vs prior ${days}d: ${fmtDelta(compare.delta.calls)} calls, ${fmtDelta(compare.delta.avgX, "×")} avg, ${fmtDelta(compare.delta.winRate, "%")} win rate`,
    rankLine,
    stats.bestX30d > 0 ? `Best hit (30d): ${stats.bestX30d.toFixed(2)}×` : "Log a desk call to start your tape",
    fivePlus != null ? `${fivePlus}% of calls reached 5×+ (ATH)` : null,
    stats.activeDaysStreak > 0 ? `${stats.activeDaysStreak}-day UTC streak` : null,
  ].filter((b): b is string => Boolean(b));

  const copyText = [
    "McGBot Performance Lab",
    headline,
    ...bullets,
    "https://mcgbot.xyz/performance",
  ].join("\n");

  return { headline, bullets, copyText };
}

export function pickSeriesForWindow(
  payload: {
    series7d?: DailyCallBucket[];
    series14d?: DailyCallBucket[];
    series30d?: DailyCallBucket[];
  },
  window: PerformanceLabWindow
): DailyCallBucket[] {
  if (window === "7d") return payload.series7d ?? [];
  if (window === "30d") return payload.series30d ?? [];
  return payload.series14d ?? [];
}
