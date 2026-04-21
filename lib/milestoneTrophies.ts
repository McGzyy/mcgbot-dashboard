/** Keep in sync with `utils/callPerformanceSync.js` CALL_CLUB_MILESTONES keys / minAth. */
export const CALL_CLUB_MILESTONE_KEYS = [
  "call_club_10x",
  "call_club_25x",
  "call_club_50x",
] as const;

export type CallClubMilestoneKey = (typeof CALL_CLUB_MILESTONE_KEYS)[number];

const CLUB_META: Record<
  CallClubMilestoneKey,
  { label: string; short: string; emoji: string }
> = {
  call_club_10x: { label: "10× club", short: "10×", emoji: "🎯" },
  call_club_25x: { label: "25× club", short: "25×", emoji: "🚀" },
  call_club_50x: { label: "50× club", short: "50×", emoji: "🌙" },
};

export function compareMilestoneKeys(a: string, b: string): number {
  const ia = CALL_CLUB_MILESTONE_KEYS.indexOf(a as CallClubMilestoneKey);
  const ib = CALL_CLUB_MILESTONE_KEYS.indexOf(b as CallClubMilestoneKey);
  const va = ia === -1 ? 1_000 : ia;
  const vb = ib === -1 ? 1_000 : ib;
  if (va !== vb) return va - vb;
  return a.localeCompare(b);
}

export function callClubMilestoneLabel(key: string): string {
  const k = key as CallClubMilestoneKey;
  if (CLUB_META[k]) return CLUB_META[k].label;
  return key.replace(/_/g, " ");
}

export function callClubMilestoneEmoji(key: string): string {
  const k = key as CallClubMilestoneKey;
  return CLUB_META[k]?.emoji ?? "🏅";
}
