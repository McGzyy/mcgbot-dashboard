import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

/** Toggle X ingest options per source (e.g. posts-only vs replies). */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const { id: rawId } = await ctx.params;
  const id = typeof rawId === "string" ? rawId.trim() : "";
  if (!id || !isUuid(id)) {
    return Response.json({ error: "Invalid source id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (!("x_exclude_replies" in o)) {
    return Response.json({ error: "Send x_exclude_replies (boolean)." }, { status: 400 });
  }
  const v = o.x_exclude_replies;
  const x_exclude_replies = v === true || v === "true" || v === 1 || v === "1";

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data: updated, error } = await db
    .from("social_feed_sources")
    .update({ x_exclude_replies })
    .eq("id", id)
    .select("id, platform, handle, display_name, active, category, x_exclude_replies")
    .maybeSingle();

  if (error) {
    console.error("[admin/social-feed-sources PATCH]", error);
    return Response.json({ error: "Update failed" }, { status: 500 });
  }
  if (!updated) {
    return Response.json({ error: "Source not found" }, { status: 404 });
  }

  return Response.json({ success: true, source: updated });
}
