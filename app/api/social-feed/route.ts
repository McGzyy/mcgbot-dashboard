import type { SocialFeedCategorySlug } from "@/lib/socialFeedCategories";
import { normalizeCategoryOther, parseSocialFeedCategorySlug } from "@/lib/socialFeedCategories";
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
  postedAtLabel: string;
  text: string;
  metricLabel?: string;
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
    .select("id, source_id, external_id, text, posted_at, like_count, author_name, author_handle")
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
      author_name: string | null;
      author_handle: string;
    };
    const src = sourceMap.get(String(row.source_id));
    if (!src || !src.active) continue;

    const categorySlug = parseSocialFeedCategorySlug(src.category) ?? "other";
    const categoryOther = normalizeCategoryOther(src.category_other);
    if (category !== "all" && categorySlug !== category) continue;

    const handleClean = src.handle.replace(/^@/, "").toLowerCase();
    const authorHandle = `@${(row.author_handle || handleClean).replace(/^@/, "")}`;
    const authorName =
      (typeof row.author_name === "string" && row.author_name.trim()) ||
      (src.display_name && src.display_name.trim()) ||
      handleClean;

    rows.push({
      id: `${src.platform}-${row.external_id}`,
      platform: src.platform,
      categorySlug,
      categoryOther,
      authorName,
      authorHandle,
      postedAtLabel: formatPostedAtLabel(row.posted_at),
      text: typeof row.text === "string" ? row.text : "",
      metricLabel: formatLikeMetric(row.like_count),
    });
  }

  return Response.json({
    success: true,
    category,
    rows,
    updatedAt: new Date().toISOString(),
  });
}
