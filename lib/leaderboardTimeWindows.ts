/**
 * Leaderboard time boundaries — all calculations use **UTC** (epoch ms).
 * Do not mix `Date` local getters for these cutoffs.
 */

// WEEKLY LEADER = resets every Monday 00:00 UTC
export function startOfWeekMondayUtcMs(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  const y = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  const dow = d.getUTCDay(); // 0 = Sun … 6 = Sat
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  return Date.UTC(y, month, day - daysFromMonday, 0, 0, 0, 0);
}

// MONTHLY LEADER = resets first day of month 00:00 UTC
export function startOfCalendarMonthUtcMs(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0);
}

/** Start of current calendar day 00:00 UTC (for “today” call lists). */
export function startOfCalendarDayUtcMs(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    0,
    0,
    0,
    0
  );
}

// RANKINGS = rolling window (last 7 days)
export function rollingSevenDaysStartUtcMs(nowMs: number = Date.now()): number {
  return nowMs - 7 * 24 * 60 * 60 * 1000;
}

/** UTC start of the trophy period (same cutoffs as daily / weekly / monthly leaderboards). */
export function periodStartMsForTrophyTimeframe(
  timeframe: "daily" | "weekly" | "monthly",
  nowMs: number = Date.now()
): number {
  switch (timeframe) {
    case "daily":
      return startOfCalendarDayUtcMs(nowMs);
    case "weekly":
      return startOfWeekMondayUtcMs(nowMs);
    case "monthly":
      return startOfCalendarMonthUtcMs(nowMs);
  }
}
