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
      .from("trusted_pro_applications")
      .select(
        "id, applicant_discord_id, application_note, snapshot_total_calls, snapshot_avg_x, snapshot_win_rate, snapshot_best_x_30d, created_at"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[mod/trusted-pro-applications/pending] supabase:", error);
      return Response.json({ success: false, error: "Failed to load pending applications" }, { status: 500 });
    }

    return Response.json({ success: true, rows: Array.isArray(data) ? data : [] });
  } catch (e) {
    console.error("[mod/trusted-pro-applications/pending] GET:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

