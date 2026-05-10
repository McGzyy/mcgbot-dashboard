/** Max concurrently monitored X handles (soft cap; raise via admin later). */
export const OUTSIDE_X_MAX_ACTIVE_SOURCES = 50;

export const OUTSIDE_X_TRUST_INITIAL = 50;
export const OUTSIDE_X_TRUST_FLOOR = 25;
export const OUTSIDE_X_TRUST_CEILING = 100;
export const OUTSIDE_X_TRUST_SUSPENSION_REVIEW_THRESHOLD = 35;
export const OUTSIDE_X_TRUST_RECOVERY_CLEAR_SCORE = 50;

/** Max upside trust points credited from a single call’s multiple ladder. */
export const OUTSIDE_X_TRUST_UPSIDE_CAP_PER_CALL = 25;

/** One-shot penalty when a call meets defined-failure rules (never reached 2× and pair is dead). */
export const OUTSIDE_X_TRUST_DEFINED_FAILURE_PENALTY = -5;

/** Absolute liquidity below this (USD) counts as “dead” when paired with sub-2×. */
export const OUTSIDE_X_DEFINED_FAILURE_MIN_LIQUIDITY_USD = 200;

/** If entry liquidity known, current below this fraction of entry counts as dead. */
export const OUTSIDE_X_DEFINED_FAILURE_LIQUIDITY_FRACTION_OF_ENTRY = 0.02;

/** Optional: if current mcap is below this fraction of entry mcap, treat as dead (sub-2× only). */
export const OUTSIDE_X_DEFINED_FAILURE_MCAP_FRACTION_OF_ENTRY = 0.05;

/** Rolling window after each fully approved submission (successful queue exit). */
export const OUTSIDE_X_SUBMIT_COOLDOWN_MS_DEFAULT = 7 * 24 * 60 * 60 * 1000;
export const OUTSIDE_X_SUBMIT_COOLDOWN_MS_ELEVATED = 24 * 60 * 60 * 1000;
