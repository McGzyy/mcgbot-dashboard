import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const { id: rawId } = await context.params;
  const discordId = decodeURIComponent(String(rawId ?? "")).trim();
  if (!discordId || discordId.length > 64) {
    return Response.json({ success: false, error: "Invalid user id" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
  }

  const { error: tErr, data: tData } = await db
    .from("user_trophies")
    .delete()
    .eq("user_id", discordId)
    .select("id");

  if (tErr) {
    console.error("[admin/users/reset-trophies] user_trophies:", tErr);
    return Response.json({ success: false, error: "Failed to reset trophies" }, { status: 500 });
  }

  let milestoneDeleted = 0;
  const { error: mErr, data: mData } = await db
    .from("user_milestone_trophies")
    .delete()
    .eq("user_id", discordId)
    .select("id");
  if (mErr) {
    console.error("[admin/users/reset-trophies] user_milestone_trophies:", mErr);
  } else {
    milestoneDeleted = Array.isArray(mData) ? mData.length : 0;
  }

  return Response.json({
    success: true,
    deleted: Array.isArray(tData) ? tData.length : 0,
    milestoneTrophiesDeleted: milestoneDeleted,
  });
}
