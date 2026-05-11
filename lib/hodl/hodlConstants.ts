/** Minimum continuous-style hold before a HODL row can go live (14 days). */
export const HODL_MIN_HOLD_MS = 14 * 24 * 60 * 60 * 1000;

/** Max signature pages per RPC scan (newest-first pagination). */
export const HODL_SIG_SCAN_MAX_PAGES = 12;

export const HODL_SIG_PAGE_LIMIT = 500;

/** Ignore dust-sized positions for eligibility (raw amount, pre-decimals). */
export const HODL_MIN_RAW_AMOUNT = BigInt(1_000);
