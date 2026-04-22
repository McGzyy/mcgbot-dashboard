import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireDashboardStaff } from "@/lib/staffGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await requireDashboardStaff();
  if (!staff.ok) return staff.response;

  try {
    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }

    const { data, error } = await db
      .from("trusted_pro_calls")
      .select(
        "id, author_discord_id, contract_address, thesis, narrative, catalysts, risks, time_horizon, entry_plan, invalidation, sources, tags, status, created_at"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[mod/trusted-pro-calls/pending] supabase:", error);
      return Response.json({ success: false, error: "Failed to load pending calls" }, { status: 500 });
    }

    return Response.json({ success: true, calls: Array.isArray(data) ? data : [] });
  } catch (e) {
    console.error("[mod/trusted-pro-calls/pending] GET:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

