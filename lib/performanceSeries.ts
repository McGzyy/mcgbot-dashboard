import { rowCallTimeUtcMs } from "@/lib/callPerformanceLeaderboard";

export type DailyCallBucket = {
  dayKey: string;
  label: string;
  calls: number;
  avgX: number;
  bestX: number;
};

function startOfUtcDayMs(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Last `numDays` UTC calendar days (including today); empty days get zeros. */
export function buildDailyCallBuckets(
  rows: Record<string, unknown>[],
  numDays: number,
  nowMs: number
): DailyCallBucket[] {
  const todayStart = startOfUtcDayMs(nowMs);
  const dayMs = 86_400_000;
  const keys: string[] = [];
  for (let i = numDays - 1; i >= 0; i -= 1) {
    keys.push(String(todayStart - i * dayMs));
  }

  const byDay = new Map<string, { sum: number; n: number; best: number }>();
  for (const k of keys) {
    byDay.set(k, { sum: 0, n: 0, best: 0 });
  }

  for (const r of rows) {
    const t = rowCallTimeUtcMs(r);
    if (t <= 0 || t > nowMs) continue;
    const day = startOfUtcDayMs(t);
    const key = String(day);
    if (!byDay.has(key)) continue;
    const x = Number(r.ath_multiple ?? 0);
    if (!Number.isFinite(x) || x <= 0) continue;
    const b = byDay.get(key)!;
    b.n += 1;
    b.sum += x;
    if (x > b.best) b.best = x;
  }

  return keys.map((k) => {
    const b = byDay.get(k)!;
    const d = new Date(Number(k));
    const label = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    return {
      dayKey: k,
      label,
      calls: b.n,
      avgX: b.n > 0 ? b.sum / b.n : 0,
      bestX: b.best,
    };
  });
}

export type MultipleDistribution = {
  under2: number;
  twoToFive: number;
  fivePlus: number;
  total: number;
};

export function computeMultipleDistribution(rows: Record<string, unknown>[]): MultipleDistribution {
  let under2 = 0;
  let twoToFive = 0;
  let fivePlus = 0;
  let total = 0;
  for (const r of rows) {
    const m = Number(r.ath_multiple ?? 0);
    if (!Number.isFinite(m) || m <= 0) continue;
    total += 1;
    if (m < 2) under2 += 1;
    else if (m < 5) twoToFive += 1;
    else fivePlus += 1;
  }
  return { under2, twoToFive, fivePlus, total };
}
