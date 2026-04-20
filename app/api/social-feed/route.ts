type SocialPlatform = "x" | "instagram";

export type SocialFeedItem = {
  id: string;
  platform: SocialPlatform;
  authorName: string;
  authorHandle: string;
  postedAtLabel: string;
  text: string;
  metricLabel?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platformRaw = (searchParams.get("platform") ?? "all").toLowerCase();
  const platform =
    platformRaw === "x" || platformRaw === "instagram" ? (platformRaw as SocialPlatform) : "all";

  return Response.json({
    success: true,
    platform,
    rows: [] as SocialFeedItem[],
    updatedAt: new Date().toISOString(),
  });
}

