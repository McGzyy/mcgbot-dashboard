/** Canonical slugs stored in DB (`social_feed_sources.category`, submissions `category`). */
export const SOCIAL_FEED_CATEGORY_SLUGS = [
  "politics",
  "law",
  "economy",
  "equities",
  "culture",
  "tech",
  "crypto",
  "protocol",
  "trader",
  "kol",
  "media",
  "other",
] as const;

export type SocialFeedCategorySlug = (typeof SOCIAL_FEED_CATEGORY_SLUGS)[number];

export const SOCIAL_FEED_CATEGORY_OPTIONS: ReadonlyArray<{
  id: SocialFeedCategorySlug;
  /** Full line for selects, tables, tooltips */
  label: string;
  /** Short label for compact filter tabs */
  short: string;
}> = [
  { id: "politics", label: "Politics & world events", short: "Politics" },
  { id: "law", label: "Law & policy", short: "Law" },
  { id: "economy", label: "Economy & rates", short: "Economy" },
  { id: "equities", label: "Stocks & earnings", short: "Stocks" },
  { id: "culture", label: "Culture, celebs & sports", short: "Culture" },
  { id: "tech", label: "Tech & AI", short: "Tech" },
  { id: "crypto", label: "Crypto & industry", short: "Crypto" },
  { id: "protocol", label: "Projects & protocols", short: "Protocol" },
  { id: "trader", label: "Traders & charts", short: "Trader" },
  { id: "kol", label: "Influencers & KOLs", short: "KOL" },
  { id: "media", label: "Shows & podcasts", short: "Media" },
  { id: "other", label: "Other (describe)", short: "Other" },
];

const SLUG_SET = new Set<string>(SOCIAL_FEED_CATEGORY_SLUGS);

export function isSocialFeedCategorySlug(s: string): s is SocialFeedCategorySlug {
  return SLUG_SET.has(s);
}

export function parseSocialFeedCategorySlug(raw: unknown): SocialFeedCategorySlug | null {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  /** Legacy slug from first taxonomy; DB migration rewrites rows, API may still send `news` briefly */
  if (s === "news") return "crypto";
  return isSocialFeedCategorySlug(s) ? s : null;
}

export function normalizeCategoryOther(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s ? s.slice(0, 120) : null;
}

/** Display line for tables and feed chrome (e.g. full option label or "Other (describe): …"). */
export function formatSocialFeedCategoryLabel(
  slug: string | null | undefined,
  other: string | null | undefined
): string {
  const s = parseSocialFeedCategorySlug(slug) ?? "other";
  const opt = SOCIAL_FEED_CATEGORY_OPTIONS.find((o) => o.id === s);
  const base = opt?.label ?? s;
  if (s === "other" && other && other.trim()) return `${base}: ${other.trim()}`;
  return base;
}
