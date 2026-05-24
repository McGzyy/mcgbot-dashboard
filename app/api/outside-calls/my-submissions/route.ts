import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireProFeaturesForSession } from "@/lib/subscription/productTierAccess";
import {
  isOutsideCallsEnabled,
  outsideCallsFeatureDisabledResponse,
} from "@/lib/outsideCallsSettings";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubmissionRow = {
  id: string;
  proposed_x_handle: string;
  proposed_display_name: string;
  status: string;
  approver_1_discord_id: string | null;
  approver_2_discord_id: string | null;
  reject_reason: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id?.trim()) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const proGate = await requireProFeaturesForSession(session);
  if (!proGate.ok) return proGate.response;

  if (!(await isOutsideCallsEnabled())) {
    return outsideCallsFeatureDisabledResponse();
  }

  const userId = session.user!.id!.trim();

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data, error } = await db
    .from("outside_source_submissions")
    .select(
      "id,proposed_x_handle,proposed_display_name,status,approver_1_discord_id,approver_2_discord_id,reject_reason,resolved_at,created_at,updated_at"
    )
    .eq("submitter_discord_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[outside-calls/my-submissions]", error);
    return Response.json({ error: "Failed to load submissions" }, { status: 500 });
  }

  const rows = (Array.isArray(data) ? data : []) as SubmissionRow[];
  const submissions = rows.map((r) => {
    const has1 = Boolean(r.approver_1_discord_id?.trim());
    const has2 = Boolean(r.approver_2_discord_id?.trim());
    let pipelineLabel = "Pending staff review";
    if (r.status === "approved") pipelineLabel = "Approved — monitor is live";
    else if (r.status === "rejected") pipelineLabel = "Rejected";
    else if (has2) pipelineLabel = "Finalizing approval";
    else if (has1) pipelineLabel = "Awaiting 2nd moderator";

    return {
      id: r.id,
      proposedXHandle: r.proposed_x_handle,
      proposedDisplayName: r.proposed_display_name,
      status: r.status,
      pipelineLabel,
      approvals: { first: has1, second: has2 },
      rejectReason: r.reject_reason,
      resolvedAt: r.resolved_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });

  return Response.json({ success: true, submissions });
}
