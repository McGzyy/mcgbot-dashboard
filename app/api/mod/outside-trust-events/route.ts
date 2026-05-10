import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { meetsModerationMinTier, moderationStaffForbiddenPayload, resolveHelpTierAsync } from "@/lib/helpRole";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim() ?? "";
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tier = await resolveHelpTierAsync(userId);
  if (!meetsModerationMinTier(tier)) {
    return Response.json(moderationStaffForbiddenPayload(), { status: 403 });
  }

  const url = new URL(request.url);
  const sourceId = (url.searchParams.get("sourceId") ?? "").trim();
  if (!sourceId) {
    return Response.json({ error: "sourceId query parameter is required" }, { status: 400 });
  }

  const lim = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(lim) && lim > 0 && lim <= 200 ? Math.floor(lim) : 50;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data, error } = await db
    .from("outside_trust_score_events")
    .select("id,call_id,delta,trust_after,kind,detail,created_at")
    .eq("source_id", sourceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[mod/outside-trust-events]", error);
    return Response.json({ success: false, error: "Failed to load events" }, { status: 500 });
  }

  return Response.json({ success: true, rows: Array.isArray(data) ? data : [] });
}
