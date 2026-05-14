import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SourceRow = {
  display_name?: string | null;
  x_handle_normalized?: string | null;
  status?: string | null;
  trust_score?: number | null;
};

type CallRow = {
  id: string;
  mint: string;
  call_role: string;
  primary_call_id: string | null;
  tweet_id: string | null;
  x_post_url: string | null;
  posted_at: string;
  signal_ticker?: string | null;
  mint_resolution?: string | null;
  outside_x_sources: SourceRow | SourceRow[] | null;
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim() ?? "";
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const lim = Number(url.searchParams.get("limit") ?? "80");
  const limit = Number.isFinite(lim) && lim > 0 && lim <= 200 ? Math.floor(lim) : 80;

  const { data, error } = await db
    .from("outside_calls")
    .select(
      `
      id,
      mint,
      call_role,
      primary_call_id,
      tweet_id,
      x_post_url,
      posted_at,
      signal_ticker,
      mint_resolution,
      outside_x_sources (
        display_name,
        x_handle_normalized,
        status,
        trust_score
      )
    `
    )
    .order("posted_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[outside-calls/feed]", error);
    return Response.json({ error: "Failed to load feed" }, { status: 500 });
  }

  const rows = (Array.isArray(data) ? data : []) as CallRow[];
  const calls = rows
    .map((r) => {
      const srcRaw = r.outside_x_sources;
      const src = Array.isArray(srcRaw) ? srcRaw[0] : srcRaw;
      if (!src || src.status !== "active") return null;
      return {
        id: r.id,
        mint: r.mint,
        callRole: r.call_role,
        primaryCallId: r.primary_call_id,
        tweetId: r.tweet_id,
        xPostUrl: r.x_post_url,
        postedAt: r.posted_at,
        signalTicker: r.signal_ticker ?? null,
        mintResolution: r.mint_resolution ?? null,
        source: {
          displayName: src.display_name ?? "",
          xHandle: src.x_handle_normalized ?? "",
          trustScore: typeof src.trust_score === "number" ? src.trust_score : null,
        },
      };
    })
    .filter(Boolean);

  return Response.json({ success: true, calls });
}
