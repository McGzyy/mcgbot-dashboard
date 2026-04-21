/** Canonical DB badge key in `user_badges.badge`. */
export const TOP_CALLER_BADGE_KEY = "top_caller" as const;

/**
 * Token returned by `/api/badges` and `/api/user/[id]/badges` for UI.
 * Single win: `top_caller`; repeats: `top_caller×3` (ASCII `x` multiplier).
 */
export function topCallerBadgeToken(timesAwarded: number): string {
  const n = Math.floor(Number(timesAwarded));
  if (!Number.isFinite(n) || n < 1) return TOP_CALLER_BADGE_KEY;
  return n <= 1 ? TOP_CALLER_BADGE_KEY : `${TOP_CALLER_BADGE_KEY}×${n}`;
}

/** Times won (0 if no top-caller badge token present). */
export function parseTopCallerTimesFromBadges(badges: string[]): number {
  for (const b of badges) {
    if (b === TOP_CALLER_BADGE_KEY) return 1;
    const m = /^top_caller×(\d+)$/.exec(b);
    if (m) {
      const n = Number(m[1]);
      return Number.isFinite(n) && n >= 1 ? n : 1;
    }
  }
  return 0;
}
