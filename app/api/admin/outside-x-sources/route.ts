import { requireDashboardAdmin } from "@/lib/adminGate";
import {
  fetchOutsideSourceCallStatsMap,
  mergeOutsideSourceCallStats,
} from "@/lib/outsideXSourceCallStats";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_SET = new Set(["active", "suspended", "removed"]);

/**
 * List all outside X monitor sources (any status) for dashboard admin UI.
 */
export async function GET(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const filter = (searchParams.get("status") ?? "all").trim().toLowerCase();

  let q = db
    .from("outside_x_sources")
    .select(
      "id,x_handle_normalized,display_name,trust_score,status,suspension_review_pending,created_at,updated_at"
    )
    .order("updated_at", { ascending: false });

  if (filter !== "all" && STATUS_SET.has(filter)) {
    q = q.eq("status", filter);
  }

  const { data, error } = await q;

  if (error) {
    console.error("[admin/outside-x-sources GET]", error);
    return Response.json({ error: "Failed to load sources" }, { status: 500 });
  }

  const rows = Array.isArray(data) ? data : [];
  const ids = rows.map((r) => (r as { id?: string }).id).filter((x): x is string => typeof x === "string");
  const statsMap = await fetchOutsideSourceCallStatsMap(db, ids);
  const merged = mergeOutsideSourceCallStats(rows as { id: string }[], statsMap);

  return Response.json({ success: true, sources: merged });
}
