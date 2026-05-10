import {
  OUTSIDE_X_DEFINED_FAILURE_LIQUIDITY_FRACTION_OF_ENTRY,
  OUTSIDE_X_DEFINED_FAILURE_MCAP_FRACTION_OF_ENTRY,
  OUTSIDE_X_DEFINED_FAILURE_MIN_LIQUIDITY_USD,
} from "@/lib/outsideXCalls/constants";

export type OutsideDefinedFailureSignals = {
  /** Peak ATH multiple recorded for this call (must stay < 2 for this rule). */
  maxAthMultiple: number;
  /** Current pool liquidity USD if known. */
  currentLiquidityUsd?: number | null;
  /** Snapshot at call time if known. */
  entryLiquidityUsd?: number | null;
  currentMcapUsd?: number | null;
  entryMcapUsd?: number | null;
  /** Indexer / worker: pair removed, migrated, or no longer tradeable. */
  pairInactiveOrRemoved?: boolean;
};

function finiteOr(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Defined failure: never reached 2× AND the tape looks dead (no liquidity / pair gone / crushed vs entry).
 * Does not fire once ATH has reached 2× (different product rules could be added later).
 */
export function evaluateOutsideDefinedFailure(s: OutsideDefinedFailureSignals): boolean {
  const maxAth = finiteOr(s.maxAthMultiple, 0);
  if (maxAth >= 2 - 1e-9) return false;

  if (s.pairInactiveOrRemoved === true) return true;

  const curLiq = s.currentLiquidityUsd;
  if (curLiq != null && Number.isFinite(curLiq) && curLiq <= OUTSIDE_X_DEFINED_FAILURE_MIN_LIQUIDITY_USD) {
    return true;
  }

  const entryLiq = s.entryLiquidityUsd;
  if (
    curLiq != null &&
    entryLiq != null &&
    Number.isFinite(curLiq) &&
    Number.isFinite(entryLiq) &&
    entryLiq > 0 &&
    curLiq < entryLiq * OUTSIDE_X_DEFINED_FAILURE_LIQUIDITY_FRACTION_OF_ENTRY
  ) {
    return true;
  }

  const curMc = s.currentMcapUsd;
  const entryMc = s.entryMcapUsd;
  if (
    curMc != null &&
    entryMc != null &&
    Number.isFinite(curMc) &&
    Number.isFinite(entryMc) &&
    entryMc > 0 &&
    curMc < entryMc * OUTSIDE_X_DEFINED_FAILURE_MCAP_FRACTION_OF_ENTRY
  ) {
    return true;
  }

  return false;
}
