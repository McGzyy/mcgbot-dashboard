import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import type { SocialFeedCategorySlug } from "@/lib/socialFeedCategories";
import { normalizeCategoryOther, parseSocialFeedCategorySlug } from "@/lib/socialFeedCategories";
import { requireProFeatures } from "@/lib/subscription/productTierAccess";
import { isSocialFeedEnabled } from "@/lib/socialFeedSettings";
import { maybeRefreshSocialFeedFromX } from "@/lib/socialFeedXIngest";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type SocialPlatform = "x" | "instagram";

export type SocialFeedItem = {
  id: string;
  platform: SocialPlatform;
  /** Source bucket for filtering (which monitored-account category this post belongs to). */
  categorySlug: SocialFeedCategorySlug;
  categoryOther?: string | null;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl?: string | null;
  authorVerified?: boolean;
  postedAtLabel: string;
  text: string;
  /** @deprecated Prefer structured counts; kept for mocks / old rows. */
  metricLabel?: string;
  likeCount?: number | null;
  replyCount?: number | null;
  retweetCount?: number | null;
  quoteCount?: number | null;
  impressionCount?: number | null;
  tweetUrl?: string | null;
};

function formatPostedAtLabel(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const d = Date.now() - t;
  const m = Math.floor(d / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d`;
}

function formatLikeMetric(n: number | null | undefined): string | undefined {
  if (n == null || !Number.isFinite(n) || n <= 0) return undefined;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`.replace(/\.0K$/, "K");
  return String(Math.round(n));
}

export async function GET(request: Request) {
  const enabled = await isSocialFeedEnabled();
  if (!enabled) {
    return Response.json({
      success: true,
      enabled: false,
      category: "all",
      rows: [],
      updatedAt: new Date().toISOString(),
    });
  }

  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const proGate = await requireProFeatures(discordId);
  if (!proGate.ok) return proGate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Supabase not configured" }, { status: 503 });
  }

  await maybeRefreshSocialFeedFromX(db);

  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("category") ?? "all").trim().toLowerCase();
  const category: "all" | SocialFeedCategorySlug =
    raw === "all" ? "all" : parseSocialFeedCategorySlug(raw) ?? "all";

  const { data: posts, error: pErr } = await db
    .from("social_feed_posts")
    .select(
      "id, source_id, external_id, text, posted_at, like_count, reply_count, retweet_count, quote_count, impression_count, author_name, author_handle, author_avatar_url, author_verified"
    )
    .order("posted_at", { ascending: false })
    .limit(200);

  if (pErr) {
    console.error("[social-feed] posts:", pErr);
    return Response.json({ success: false, error: "Failed to load feed" }, { status: 500 });
  }

  const sourceIds = [...new Set((posts ?? []).map((p) => String((p as { source_id?: string }).source_id ?? "")))].filter(
    Boolean
  );

  let sourceMap = new Map<
    string,
    {
      platform: SocialPlatform;
      handle: string;
      display_name: string | null;
      category: string | null;
      category_other: string | null;
      active: boolean;
    }
  >();

  if (sourceIds.length > 0) {
    const { data: sources, error: sErr } = await db
      .from("social_feed_sources")
      .select("id, platform, handle, display_name, category, category_other, active")
      .in("id", sourceIds);

    if (sErr) {
      console.error("[social-feed] sources:", sErr);
      return Response.json({ success: false, error: "Failed to load feed" }, { status: 500 });
    }

    sourceMap = new Map(
      (sources ?? []).map((r) => {
        const row = r as {
          id: string;
          platform: string;
          handle: string;
          display_name: string | null;
          category: string | null;
          category_other: string | null;
          active: boolean;
        };
        return [
          String(row.id),
          {
            platform: row.platform === "instagram" ? "instagram" : "x",
            handle: String(row.handle ?? ""),
            display_name: row.display_name ?? null,
            category: row.category ?? null,
            category_other: row.category_other ?? null,
            active: Boolean(row.active),
          },
        ];
      })
    );
  }

  const rows: SocialFeedItem[] = [];

  for (const p of posts ?? []) {
    const row = p as {
      source_id: string;
      external_id: string;
      text: string;
      posted_at: string;
      like_count: number | null;
      reply_count?: number | null;
      retweet_count?: number | null;
      quote_count?: number | null;
      impression_count?: number | null;
      author_name: string | null;
      author_handle: string;
      author_avatar_url?: string | null;
      author_verified?: boolean | null;
    };
    const src = sourceMap.get(String(row.source_id));
    if (!src || !src.active) continue;

    const categorySlug = parseSocialFeedCategorySlug(src.category) ?? "other";
    const categoryOther = normalizeCategoryOther(src.category_other);
    if (category !== "all" && categorySlug !== category) continue;

    const handleClean = src.handle.replace(/^@/, "").toLowerCase();
    const handleNoAt = (row.author_handle || handleClean).replace(/^@/, "").toLowerCase();
    const authorHandle = `@${handleNoAt}`;
    const authorName =
      (typeof row.author_name === "string" && row.author_name.trim()) ||
      (src.display_name && src.display_name.trim()) ||
      handleClean;

    const avatar =
      typeof row.author_avatar_url === "string" && row.author_avatar_url.startsWith("http")
        ? row.author_avatar_url
        : null;

    const tweetUrl =
      src.platform === "x" && row.external_id
        ? `https://x.com/${encodeURIComponent(handleNoAt)}/status/${encodeURIComponent(row.external_id)}`
        : null;

    const like = row.like_count;
    const reply = row.reply_count ?? null;
    const retweet = row.retweet_count ?? null;
    const quote = row.quote_count ?? null;
    const impression = row.impression_count ?? null;
    const hasStructured =
      (typeof like === "number" && Number.isFinite(like)) ||
      (typeof reply === "number" && Number.isFinite(reply)) ||
      (typeof retweet === "number" && Number.isFinite(retweet)) ||
      (typeof quote === "number" && Number.isFinite(quote)) ||
      (typeof impression === "number" && Number.isFinite(impression));

    rows.push({
      id: `${src.platform}-${row.external_id}`,
      platform: src.platform,
      categorySlug,
      categoryOther,
      authorName,
      authorHandle,
      authorAvatarUrl: avatar,
      authorVerified: Boolean(row.author_verified),
      postedAtLabel: formatPostedAtLabel(row.posted_at),
      text: typeof row.text === "string" ? row.text : "",
      metricLabel: hasStructured ? undefined : formatLikeMetric(row.like_count),
      likeCount: row.like_count,
      replyCount: reply,
      retweetCount: retweet,
      quoteCount: quote,
      impressionCount: impression,
      tweetUrl,
    });
  }

  return Response.json({
    success: true,
    enabled: true,
    category,
    rows,
    updatedAt: new Date().toISOString(),
  });
}
