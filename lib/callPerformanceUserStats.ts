import { rowCallTimeUtcMs } from "@/lib/callPerformanceLeaderboard";

/** Shape returned by `/api/me/recent-calls` and profile `recentCalls`. */
export type RecentCallDto = {
  id?: string;
  token: string;
  multiple: number;
  time: unknown;
};

/** Same rules as `/api/me/stats`: avg of `ath_multiple`, win = multiple ≥ 2. */
export function computeCallPerformanceUserStats(
  rows: Record<string, unknown>[]
): { avgX: number; winRate: number; totalCalls: number } {
  const totalCalls = rows.length;
  const avgX =
    totalCalls > 0
      ? rows.reduce((sum, r) => sum + Number(r.ath_multiple ?? 0), 0) /
        totalCalls
      : 0;
  const wins = rows.filter((r) => Number(r.ath_multiple) >= 2).length;
  const winRate = totalCalls > 0 ? (wins / totalCalls) * 100 : 0;
  return { avgX, winRate, totalCalls };
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
  const multiple = Number(row.ath_multiple ?? 0);
  return {
    id: id || undefined,
    token,
    multiple: Number.isFinite(multiple) ? multiple : 0,
    time: row.call_time,
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
