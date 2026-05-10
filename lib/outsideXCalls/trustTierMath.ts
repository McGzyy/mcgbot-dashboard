import { OUTSIDE_X_TRUST_UPSIDE_CAP_PER_CALL } from "@/lib/outsideXCalls/constants";

/**
 * Cumulative upside trust points implied by ATH multiple `m` (capped per call).
 * Ladder: +6 at 2×, +1 for each integer 3…10 crossed, then +2 at 15×, 20×, 25×, … until cap 25.
 */
export function cumulativeOutsideUpsidePointsAtMultiple(multiple: number): number {
  const m = Number(multiple);
  if (!Number.isFinite(m) || m < 2) return 0;

  let pts = 6;
  const upto = Math.min(10, Math.floor(m));
  for (let k = 3; k <= upto; k++) pts += 1;

  if (m < 15) {
    return Math.min(OUTSIDE_X_TRUST_UPSIDE_CAP_PER_CALL, pts);
  }

  for (let boundary = 15; boundary <= Math.floor(m); boundary += 5) {
    pts += 2;
  }

  return Math.min(OUTSIDE_X_TRUST_UPSIDE_CAP_PER_CALL, pts);
}

/** New upside points to credit when ATH moves from prevMultiple → newMultiple (idempotent). */
export function upsideTrustDeltaBetweenMultiples(prevMultiple: number, newMultiple: number): number {
  const prev = Number(prevMultiple);
  const next = Number(newMultiple);
  if (!Number.isFinite(prev) || !Number.isFinite(next) || next <= prev) return 0;
  const a = cumulativeOutsideUpsidePointsAtMultiple(prev);
  const b = cumulativeOutsideUpsidePointsAtMultiple(next);
  return Math.max(0, b - a);
}
