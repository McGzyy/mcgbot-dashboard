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

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "pending").trim() || "pending";
  if (status !== "pending" && status !== "approved" && status !== "rejected") {
    return Response.json({ error: "Invalid status filter" }, { status: 400 });
  }

  const lim = Number(url.searchParams.get("limit") ?? "80");
  const limit = Number.isFinite(lim) && lim > 0 && lim <= 200 ? Math.floor(lim) : 80;

  const { data, error } = await db
    .from("outside_source_submissions")
    .select(
      "id,submitter_discord_id,proposed_x_handle,proposed_display_name,submitter_note,track_record,extra_context,status,approver_1_discord_id,approver_1_at,approver_2_discord_id,approver_2_at,resolved_source_id,resolved_at,reject_reason,created_at,updated_at"
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[mod/outside-source-submissions]", error);
    return Response.json({ success: false, error: "Failed to load submissions" }, { status: 500 });
  }

  return Response.json({ success: true, rows: Array.isArray(data) ? data : [] });
}
