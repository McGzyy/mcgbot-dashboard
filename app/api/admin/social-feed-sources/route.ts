import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * List social feed sources (for admin: X reply filter and handles).
 */
export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data, error } = await db
    .from("social_feed_sources")
    .select("id, platform, handle, display_name, active, category, category_other, x_exclude_replies")
    .order("platform", { ascending: true })
    .order("handle", { ascending: true });

  if (error) {
    console.error("[admin/social-feed-sources GET]", error);
    return Response.json({ error: "Failed to load sources" }, { status: 500 });
  }

  return Response.json({ success: true, sources: Array.isArray(data) ? data : [] });
}
