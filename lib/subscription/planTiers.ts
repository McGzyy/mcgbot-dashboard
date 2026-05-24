export type ProductTier = "basic" | "pro";

export type TierFeatureValue = boolean | "limited" | "10_per_day";

export type TierFeatureRow = {
  label: string;
  basic: TierFeatureValue;
  pro: TierFeatureValue;
};

/** Basic desk calls submitted per UTC calendar day. */
export const BASIC_DAILY_CALLS_LIMIT = 10;

/** Canonical feature matrix — membership UI and future gates read from here. */
export const MEMBERSHIP_TIER_FEATURES: TierFeatureRow[] = [
  { label: "Full dashboard & verified call tape", basic: true, pro: true },
  { label: "Leaderboard, profiles & desk intel", basic: true, pro: true },
  { label: "Caller intelligence (7d / 30d / 90d)", basic: true, pro: true },
  { label: "Contract watchlist (save CAs)", basic: true, pro: true },
  { label: "Desk calls (submit from terminal)", basic: "10_per_day", pro: true },
  { label: "Log desk calls from X (@McGBot + CA)", basic: false, pro: true },
  { label: "Rich X calls on X (narrative + images, Trusted Pro & staff)", basic: false, pro: true },
  { label: "Outside Calls (off-desk X lane)", basic: false, pro: true },
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
    tagline: "Run the daily desk loop — log calls, read the tape, and track your edge.",
    accent: "emerald",
  },
  pro: {
    title: "Pro",
    tagline:
      "Everything in Basic, plus the off-desk Outside Calls lane, full inbox alerts with Discord DMs, and unlimited desk submissions.",
    accent: "sky",
  },
};

/** One-line “what you do daily” — shown on membership, not a feature matrix. */
export const TIER_DAILY_ROUTINE: Record<ProductTier, string> = {
  basic: `Submit up to ${BASIC_DAILY_CALLS_LIMIT} desk calls per day, follow live activity, and review Performance Lab — enough for most daily traders.`,
  pro: "No daily cap on desk calls, the Outside Calls off-desk tape, and full alerts mirrored to Discord when you step away.",
};

/** Short bullets on tier cards (3–4 each). Full matrix stays in docs/admin. */
export const TIER_COMPARE_HIGHLIGHTS: Record<ProductTier, string[]> = {
  basic: [
    "Log desk calls and track multiples",
    "Live activity, leaderboard & desk intel",
    "Call log, Performance Lab & watchlist",
  ],
  pro: [
    "Unlimited desk submissions — no daily cap",
    "Tag @McGBot on X with a CA to log desk calls",
    "Off-desk Outside Calls tape + propose monitors",
    "Full alerts + optional Discord DM mirror",
    "Home social feed when staff enable it",
  ],
};

export function normalizeProductTier(raw: unknown): ProductTier {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return s === "pro" ? "pro" : "basic";
}

export function tierIncludesProFeatures(tier: ProductTier): boolean {
  return tier === "pro";
}
