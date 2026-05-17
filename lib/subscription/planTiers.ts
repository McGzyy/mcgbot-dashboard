export type ProductTier = "basic" | "pro";

export type TierFeatureValue = boolean | "limited" | "10_per_day";

export type TierFeatureRow = {
  label: string;
  basic: TierFeatureValue;
  pro: TierFeatureValue;
};

/** Basic Outside Calls cap (UTC calendar day). */
export const BASIC_OUTSIDE_CALLS_PER_DAY = 10;

/** Canonical feature matrix — membership UI and future gates read from here. */
export const MEMBERSHIP_TIER_FEATURES: TierFeatureRow[] = [
  { label: "Full dashboard & verified call tape", basic: true, pro: true },
  { label: "Leaderboard, profiles & desk intel", basic: true, pro: true },
  { label: "Caller intelligence on profiles", basic: true, pro: true },
  { label: "Contract watchlist (save CAs)", basic: true, pro: true },
  { label: "Outside Calls", basic: "10_per_day", pro: true },
  { label: "Social feed on home (when enabled)", basic: false, pro: true },
  { label: "Personal alerts (watchlist / follows)", basic: "limited", pro: true },
  { label: "Rich X digests & heavy scans", basic: false, pro: true },
];

export const TIER_MARKETING: Record<
  ProductTier,
  { title: string; tagline: string; accent: "emerald" | "sky" }
> = {
  basic: {
    title: "Basic",
    tagline: "Full desk access — calls, stats, watchlist, and profiles.",
    accent: "emerald",
  },
  pro: {
    title: "Pro",
    tagline: "Everything in Basic plus features that run ongoing API & credit cost.",
    accent: "sky",
  },
};

export function normalizeProductTier(raw: unknown): ProductTier {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return s === "pro" ? "pro" : "basic";
}

export function tierIncludesProFeatures(tier: ProductTier): boolean {
  return tier === "pro";
}
