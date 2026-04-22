import { rowCallTimeUtcMs } from "@/lib/callPerformanceLeaderboard";
import { rowAthMultiple, rowLiveMultiple } from "@/lib/callPerformanceMultiples";

/** Shape returned by `/api/me/recent-calls` and profile `recentCalls`. */
export type RecentCallDto = {
  id?: string;
  /** Mint / contract (Solana CA). */
  token: string;
  /** Peak ATH ÷ MC at call (caller stats; ≥ 1 when synced). */
  multiple: number;
  /** Current MC ÷ call MC when the bot has written `spot_multiple`. */
  liveMultiple?: number;
  time: unknown;
  excludedFromStats?: boolean;
  tokenName?: string | null;
  tokenTicker?: string | null;
  callMarketCapUsd?: number | null;
  /** Last scanned MC from the bot (when `spot_multiple` is synced). */
  liveMarketCapUsd?: number | null;
  tokenImageUrl?: string | null;
};

/** Avg / rollups use ATH since call; win rate = ATH ≥ 2×. */
export function computeCallPerformanceUserStats(
  rows: Record<string, unknown>[]
): { avgX: number; winRate: number; totalCalls: number } {
  const totalCalls = rows.length;
  const avgX =
    totalCalls > 0
      ? rows.reduce((sum, r) => sum + rowAthMultiple(r), 0) / totalCalls
      : 0;
  const wins = rows.filter((r) => rowAthMultiple(r) >= 2).length;
  const winRate = totalCalls > 0 ? (wins / totalCalls) * 100 : 0;
  return { avgX, winRate, totalCalls };
}

/** Median of ATH multiple since call. */
export function computeMedianX(rows: Record<string, unknown>[]): number {
  const xs = rows
    .map((r) => rowAthMultiple(r))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const n = xs.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
}

/** Rolling window by `call_time` (same idea as `/api/me/stats` `callsToday`). */
export function countCallsInLastMs(
  rows: Record<string, unknown>[],
  windowMs: number,
  nowMs: number
): number {
  return rows.filter((r) => {
    const t = rowCallTimeUtcMs(r);
    return t > 0 && nowMs - t < windowMs && nowMs >= t;
  }).length;
}

export function bestXInLastMs(
  rows: Record<string, unknown>[],
  windowMs: number,
  nowMs: number
): number {
  let best = 0;
  for (const r of rows) {
    const t = rowCallTimeUtcMs(r);
    if (t <= 0 || nowMs < t || nowMs - t >= windowMs) continue;
    const x = rowAthMultiple(r);
    if (Number.isFinite(x) && x > best) best = x;
  }
  return best;
}

export function hitRate2xInLastMs(
  rows: Record<string, unknown>[],
  windowMs: number,
  nowMs: number
): number {
  let total = 0;
  let hits = 0;
  for (const r of rows) {
    const t = rowCallTimeUtcMs(r);
    if (t <= 0 || nowMs < t || nowMs - t >= windowMs) continue;
    total += 1;
    if (rowAthMultiple(r) >= 2) hits += 1;
  }
  return total > 0 ? (hits / total) * 100 : 0;
}

/** Calls in the prior window of the same length immediately before `countCallsInLastMs` (e.g. 24h–48h ago). */
export function countCallsInPriorRollingWindow(
  rows: Record<string, unknown>[],
  windowMs: number,
  nowMs: number
): number {
  return rows.filter((r) => {
    const t = rowCallTimeUtcMs(r);
    if (t <= 0 || nowMs < t) return false;
    const age = nowMs - t;
    return age >= windowMs && age < 2 * windowMs;
  }).length;
}

function startOfUtcDayMs(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * "Active days" streak: consecutive UTC calendar days with ≥1 call, counting
 * backward from today if active today, otherwise from yesterday.
 */
export function computeActiveDaysStreakUtc(
  rows: Record<string, unknown>[],
  nowMs: number
): number {
  const days = new Set<number>();
  for (const r of rows) {
    const t = rowCallTimeUtcMs(r);
    if (t > 0 && nowMs >= t) days.add(startOfUtcDayMs(t));
  }
  if (days.size === 0) return 0;

  const today = startOfUtcDayMs(nowMs);
  const yesterday = today - 86_400_000;
  let cursor = days.has(today) ? today : days.has(yesterday) ? yesterday : null;
  if (cursor == null) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 86_400_000;
  }
  return streak;
}

export function mapCallPerformanceRowToRecentCall(
  row: Record<string, unknown>
): RecentCallDto {
  const idRaw = row.id;
  const id =
    typeof idRaw === "string"
      ? idRaw.trim()
      : idRaw == null
        ? ""
        : String(idRaw).trim();
  const raw = row.call_ca;
  const token =
    typeof raw === "string" && raw.trim() !== ""
      ? raw.trim()
      : String(raw ?? "Unknown") || "Unknown";
  const multiple = rowAthMultiple(row);
  const liveMultiple = rowLiveMultiple(row);
  const tn = (row as Record<string, unknown>).token_name;
  const tt = (row as Record<string, unknown>).token_ticker;
  const mcRaw = (row as Record<string, unknown>).call_market_cap_usd;
  const mcNum = typeof mcRaw === "number" ? mcRaw : Number(mcRaw);
  const liveMcRaw = (row as Record<string, unknown>).live_market_cap_usd;
  const liveMcNum =
    typeof liveMcRaw === "number" ? liveMcRaw : Number(liveMcRaw ?? NaN);
  const imgRaw = (row as Record<string, unknown>).token_image_url;
  const tokenImageUrl =
    typeof imgRaw === "string" && imgRaw.trim() ? imgRaw.trim().slice(0, 800) : null;
  return {
    id: id || undefined,
    token,
    multiple: Number.isFinite(multiple) ? multiple : 0,
    ...(Number.isFinite(liveMultiple) && liveMultiple > 0
      ? { liveMultiple }
      : {}),
    time: row.call_time,
    excludedFromStats: (row as any).excluded_from_stats === true,
    tokenName: typeof tn === "string" && tn.trim() ? tn.trim() : null,
    tokenTicker: typeof tt === "string" && tt.trim() ? tt.trim() : null,
    callMarketCapUsd:
      Number.isFinite(mcNum) && mcNum > 0 ? mcNum : null,
    liveMarketCapUsd:
      Number.isFinite(liveMcNum) && liveMcNum > 0 ? liveMcNum : null,
    tokenImageUrl,
  };
}

export function recentCallsFromRows(
  rows: Record<string, unknown>[],
  limit: number
): RecentCallDto[] {
  const sorted = [...rows].sort(
    (a, b) => rowCallTimeUtcMs(b) - rowCallTimeUtcMs(a)
  );
  return sorted.slice(0, Math.max(0, limit)).map(mapCallPerformanceRowToRecentCall);
}

/** Latest non-empty `username` when rows are sorted by time descending. */
export function pickLatestUsername(
  rows: Record<string, unknown>[],
  fallback: string
): string {
  const sorted = [...rows].sort(
    (a, b) => rowCallTimeUtcMs(b) - rowCallTimeUtcMs(a)
  );
  for (const r of sorted) {
    const u = r.username;
    if (typeof u === "string" && u.trim() !== "") return u.trim();
  }
  return fallback;
}
