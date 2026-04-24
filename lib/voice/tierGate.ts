import type { HelpTier } from "@/lib/helpRole";

const rank: Record<HelpTier, number> = {
  user: 0,
  mod: 1,
  admin: 2,
};

/** True if `userTier` is at least `minTier` (admin ≥ mod ≥ user). */
export function tierMeetsLobby(minTier: HelpTier, userTier: HelpTier): boolean {
  return rank[userTier] >= rank[minTier];
}
