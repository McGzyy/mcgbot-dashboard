/**
 * Live multiple: current MC / MC at call (`spot_multiple`), written by the bot monitor.
 * Before migration or between ticks, falls back to `ath_multiple`.
 */
export function rowLiveMultiple(row: Record<string, unknown>): number {
  const spot = Number((row as { spot_multiple?: unknown }).spot_multiple);
  if (Number.isFinite(spot) && spot > 0) return spot;
  const ath = Number(row.ath_multiple);
  return Number.isFinite(ath) && ath > 0 ? ath : 0;
}

/** Best of live spot vs ATH peak (for "best X" cards that should never look below reality). */
export function rowBestMultiple(row: Record<string, unknown>): number {
  const live = rowLiveMultiple(row);
  const ath = Number(row.ath_multiple);
  const a = Number.isFinite(ath) && ath > 0 ? ath : 0;
  return Math.max(live, a);
}
