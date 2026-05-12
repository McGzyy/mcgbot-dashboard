/** Canonical slugs stored in DB (`social_feed_sources.category`, submissions `category`). */
export const SOCIAL_FEED_CATEGORY_SLUGS = [
  "kol",
  "protocol",
  "news",
  "trader",
  "media",
  "other",
] as const;

export type SocialFeedCategorySlug = (typeof SOCIAL_FEED_CATEGORY_SLUGS)[number];

export const SOCIAL_FEED_CATEGORY_OPTIONS: ReadonlyArray<{
  id: SocialFeedCategorySlug;
  label: string;
}> = [
  { id: "kol", label: "KOL / influencer" },
  { id: "protocol", label: "Protocol / project" },
  { id: "news", label: "News & media" },
  { id: "trader", label: "Trader / TA" },
  { id: "media", label: "Media / content" },
  { id: "other", label: "Other (describe)" },
];

const SLUG_SET = new Set<string>(SOCIAL_FEED_CATEGORY_SLUGS);

export function isSocialFeedCategorySlug(s: string): s is SocialFeedCategorySlug {
  return SLUG_SET.has(s);
}

export function parseSocialFeedCategorySlug(raw: unknown): SocialFeedCategorySlug | null {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return isSocialFeedCategorySlug(s) ? s : null;
}

export function normalizeCategoryOther(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s ? s.slice(0, 120) : null;
}

/** Display line for tables and feed chrome (e.g. "KOL / influencer" or "Other — …"). */
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
