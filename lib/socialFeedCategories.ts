/** Canonical slugs stored in DB (`social_feed_sources.category`, submissions `category`). */
export const SOCIAL_FEED_CATEGORY_SLUGS = [
  "crypto",
  "politics",
  "economy",
  "culture",
  "other",
] as const;

export type SocialFeedCategorySlug = (typeof SOCIAL_FEED_CATEGORY_SLUGS)[number];

export const SOCIAL_FEED_CATEGORY_OPTIONS: ReadonlyArray<{
  id: SocialFeedCategorySlug;
  /** Full line for selects, tables, tooltips */
  label: string;
  /** Short label for compact filter tabs */
  short: string;
  /** If false, hidden from home feed chip row (still in submit/admin selects). */
  inFeedTabs: boolean;
}> = [
  { id: "crypto", label: "Crypto & industry", short: "Crypto", inFeedTabs: true },
  { id: "politics", label: "Politics & world events", short: "Politics", inFeedTabs: true },
  { id: "economy", label: "Economy, markets & policy", short: "Economy", inFeedTabs: true },
  { id: "culture", label: "Culture, tech & media", short: "Culture", inFeedTabs: true },
  { id: "other", label: "Other (describe)", short: "Other", inFeedTabs: false },
];

const SLUG_SET = new Set<string>(SOCIAL_FEED_CATEGORY_SLUGS);

/** Maps retired / granular slugs to the current five. */
const LEGACY_CATEGORY_SLUG: Record<string, SocialFeedCategorySlug> = {
  news: "crypto",
  protocol: "crypto",
  trader: "crypto",
  kol: "crypto",
  media: "crypto",
  law: "economy",
  equities: "economy",
  tech: "culture",
};

export function isSocialFeedCategorySlug(s: string): s is SocialFeedCategorySlug {
  return SLUG_SET.has(s);
}

export function parseSocialFeedCategorySlug(raw: unknown): SocialFeedCategorySlug | null {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const mapped = LEGACY_CATEGORY_SLUG[s] ?? s;
  return isSocialFeedCategorySlug(mapped) ? mapped : null;
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
