import { postTweetTextOAuth1a } from "@/lib/xPosterTweetTextOAuth1a";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { runXLeaderboardDigestCron } from "@/lib/xLeaderboardDigestCron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorizeCron(request: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const header = (request.headers.get("x-cron-secret") ?? "").trim();
  return bearer === secret || header === secret;
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const result = await runXLeaderboardDigestCron(db, postTweetTextOAuth1a);
  return Response.json({ success: true, ...result });
}

export async function GET(request: Request) {
  return POST(request);
}
