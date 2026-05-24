import { rowCallTimeUtcMs } from "@/lib/callPerformanceLeaderboard";
import { clampAthMultipleForStats, rowAthMultiple } from "@/lib/callPerformanceMultiples";
import { filterCallRowsForStats } from "@/lib/statsCutover";

export function parseIsoTimeMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function avgAthFromCallPerformanceRows(
  rawRows: Record<string, unknown>[],
  cutoverMs: number | null,
  minMs: number,
  nowMs: number,
  filter?: (row: Record<string, unknown>) => boolean
): number | null {
  let rows = filterCallRowsForStats(rawRows, cutoverMs);
  rows = rows.filter((r) => {
    const t = rowCallTimeUtcMs(r);
    if (t <= 0 || t < minMs || t >= nowMs) return false;
    return filter ? filter(r) : true;
  });

  let sum = 0;
  let n = 0;
  for (const r of rows) {
    const multiple = rowAthMultiple(r);
    if (multiple <= 0) continue;
    sum += multiple;
    n += 1;
  }
  return n > 0 ? sum / n : null;
}

export function avgAthFromTrustedProRows(
  rows: Record<string, unknown>[],
  minMs: number,
  nowMs: number
): number | null {
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    const t = parseIsoTimeMs(r.published_at ?? r.created_at);
    if (t <= 0 || t < minMs || t >= nowMs) continue;
    const ath = clampAthMultipleForStats(Number(r.ath_multiple));
    if (!Number.isFinite(ath) || ath <= 0) continue;
    sum += ath;
    n += 1;
  }
  return n > 0 ? sum / n : null;
}

export function avgAthFromOutsideCallRows(
  rows: Record<string, unknown>[],
  minMs: number,
  nowMs: number
): number | null {
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    const t = parseIsoTimeMs(r.posted_at);
    if (t <= 0 || t < minMs || t >= nowMs) continue;

    const srcRaw = r.outside_x_sources;
    const src = Array.isArray(srcRaw) ? srcRaw[0] : srcRaw;
    if (src && typeof src === "object" && (src as { status?: string }).status !== "active") {
      continue;
    }

    const ath = clampAthMultipleForStats(Number(r.trust_max_ath_multiple));
    if (!Number.isFinite(ath) || ath <= 0) continue;
    sum += ath;
    n += 1;
  }
  return n > 0 ? sum / n : null;
}

export function formatSidebarNavAthAvg(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return "—";
  return `${v >= 10 ? v.toFixed(1) : v.toFixed(2)}×`;
}
