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

/** Inclusive start and exclusive end for `call_time` filtering (UTC epoch ms). */
export type TrophyCallTimeWindow = {
  periodStartMs: number;
  endMsExclusive: number;
};

/** Calendar day that ended most recently (yesterday 00:00 UTC → today 00:00 UTC exclusive). */
export function priorClosedDailyWindowUtcMs(
  nowMs: number = Date.now()
): TrophyCallTimeWindow | null {
  const endMsExclusive = startOfCalendarDayUtcMs(nowMs);
  const periodStartMs = endMsExclusive - 24 * 60 * 60 * 1000;
  if (periodStartMs < 0) return null;
  return { periodStartMs, endMsExclusive };
}

/** Monday-aligned week that ended most recently (previous Monday 00:00 → this Monday 00:00 exclusive). */
export function priorClosedWeeklyWindowUtcMs(
  nowMs: number = Date.now()
): TrophyCallTimeWindow | null {
  const thisMondayStart = startOfWeekMondayUtcMs(nowMs);
  const periodStartMs = startOfWeekMondayUtcMs(thisMondayStart - 1);
  return { periodStartMs, endMsExclusive: thisMondayStart };
}

/** Calendar month that ended most recently (1st 00:00 → next month 1st 00:00 exclusive). */
export function priorClosedMonthlyWindowUtcMs(
  nowMs: number = Date.now()
): TrophyCallTimeWindow | null {
  const thisMonthStart = startOfCalendarMonthUtcMs(nowMs);
  const periodStartMs = startOfCalendarMonthUtcMs(thisMonthStart - 1);
  return { periodStartMs, endMsExclusive: thisMonthStart };
}

export function closedTrophyWindowUtcMs(
  timeframe: "daily" | "weekly" | "monthly",
  nowMs: number = Date.now()
): TrophyCallTimeWindow | null {
  switch (timeframe) {
    case "daily":
      return priorClosedDailyWindowUtcMs(nowMs);
    case "weekly":
      return priorClosedWeeklyWindowUtcMs(nowMs);
    case "monthly":
      return priorClosedMonthlyWindowUtcMs(nowMs);
  }
}
