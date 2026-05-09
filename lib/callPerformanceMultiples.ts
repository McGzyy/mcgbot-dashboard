/**
 * Upper bound for ATH / spot multiples in stats, leaderboards, and public teasers.
 * Prevents absurd values when MC at call was dust / glitched vs ATH MC (e.g. 20M×).
 * Raw DB values may still exceed this; clamp at read time and when syncing from the bot.
 */
export const ATH_MULTIPLE_STATS_MAX = 50_000;

export function clampAthMultipleForStats(multiple: number): number {
  if (!Number.isFinite(multiple) || multiple <= 0) return 0;
  return Math.min(multiple, ATH_MULTIPLE_STATS_MAX);
}

/**
 * Peak ATH multiple since call: ATH MC ÷ MC at call (`ath_multiple` from the bot).
 * Caller stats, averages, and activity badges use this — not below 1× while data is sane.
 */
export function rowAthMultiple(row: Record<string, unknown>): number {
  const ath =
    typeof row.ath_multiple === "number" && Number.isFinite(row.ath_multiple)
      ? row.ath_multiple
      : Number(row.ath_multiple);
  if (!Number.isFinite(ath) || ath <= 0) return 0;
  return clampAthMultipleForStats(ath);
}

/**
 * Live multiple: current MC ÷ call MC (`spot_multiple`), written by the bot monitor.
 * Use for explicit “live” UI (e.g. call log Live ×); falls back to ATH if spot missing.
 */
export function rowLiveMultiple(row: Record<string, unknown>): number {
  const spot = Number((row as { spot_multiple?: unknown }).spot_multiple);
  if (Number.isFinite(spot) && spot > 0) return clampAthMultipleForStats(spot);
  return rowAthMultiple(row);
}

/** Max of live spot vs ATH (e.g. distribution views where you want “how big did it get”). */
export function rowBestMultiple(row: Record<string, unknown>): number {
  const live = rowLiveMultiple(row);
  const ath = rowAthMultiple(row);
  return Math.max(live, ath);
}
