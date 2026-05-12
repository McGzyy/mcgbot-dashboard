import type { SocialFeedCategorySlug } from "@/lib/socialFeedCategories";
import { parseSocialFeedCategorySlug } from "@/lib/socialFeedCategories";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("category") ?? "all").trim().toLowerCase();
  const category: "all" | SocialFeedCategorySlug =
    raw === "all" ? "all" : parseSocialFeedCategorySlug(raw) ?? "all";

  return Response.json({
    success: true,
    category,
    rows: [] as SocialFeedItem[],
    updatedAt: new Date().toISOString(),
  });
}
