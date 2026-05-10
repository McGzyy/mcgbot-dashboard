import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { meetsModerationMinTier, moderationStaffForbiddenPayload, resolveHelpTierAsync } from "@/lib/helpRole";
import { OUTSIDE_X_MAX_ACTIVE_SOURCES } from "@/lib/outsideXCalls/constants";
import { countActiveOutsideXSources } from "@/lib/outsideXCalls/activeSourcesCount";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type SubmissionRow = {
  id: string;
  submitter_discord_id: string;
  proposed_x_handle: string;
  proposed_display_name: string;
  status: string;
  approver_1_discord_id: string | null;
  approver_1_at: string | null;
  approver_2_discord_id: string | null;
};

export async function POST(_request: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  const modId = session?.user?.id?.trim() ?? "";
  if (!modId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tier = await resolveHelpTierAsync(modId);
  if (!meetsModerationMinTier(tier)) {
    return Response.json(moderationStaffForbiddenPayload(), { status: 403 });
  }

  const { id: rawId } = await ctx.params;
  const submissionId = typeof rawId === "string" ? rawId.trim() : "";
  if (!submissionId) {
    return Response.json({ error: "Missing submission id" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data: subRaw, error: fetchErr } = await db
    .from("outside_source_submissions")
    .select(
      "id,submitter_discord_id,proposed_x_handle,proposed_display_name,status,approver_1_discord_id,approver_1_at,approver_2_discord_id"
    )
    .eq("id", submissionId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[mod/outside-source-submissions/approve] fetch", fetchErr);
    return Response.json({ error: "Failed to load submission" }, { status: 500 });
  }

  const sub = subRaw as SubmissionRow | null;
  if (!sub || sub.status !== "pending") {
    return Response.json({ error: "Submission is not pending" }, { status: 400 });
  }

  if (sub.submitter_discord_id.trim() === modId) {
    return Response.json({ error: "You cannot approve a submission you created." }, { status: 403 });
  }

  const nowIso = new Date().toISOString();

  if (!sub.approver_1_discord_id) {
    const { data: updated, error: upErr } = await db
      .from("outside_source_submissions")
      .update({
        approver_1_discord_id: modId,
        approver_1_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", submissionId)
      .eq("status", "pending")
      .is("approver_1_discord_id", null)
      .select("id")
      .maybeSingle();

    if (upErr) {
      console.error("[mod/outside-source-submissions/approve] first", upErr);
      return Response.json({ error: "Update failed" }, { status: 500 });
    }
    if (!updated) {
      return Response.json({ error: "Submission state changed; refresh and try again." }, { status: 409 });
    }

    return Response.json({
      success: true,
      step: "first_approval_recorded",
      message: "First approval recorded. A different moderator must complete the second approval.",
    });
  }

  if (sub.approver_1_discord_id.trim() === modId) {
    return Response.json(
      { error: "A different moderator must provide the second approval.", code: "SAME_APPROVER" },
      { status: 400 }
    );
  }

  const activeCount = await countActiveOutsideXSources(db);
  if (activeCount >= OUTSIDE_X_MAX_ACTIVE_SOURCES) {
    return Response.json(
      {
        error: `Monitor list is at capacity (${OUTSIDE_X_MAX_ACTIVE_SOURCES}). Remove or suspend a source before approving.`,
        code: "CAPACITY",
      },
      { status: 503 }
    );
  }

  const { data: insertedSource, error: insErr } = await db
    .from("outside_x_sources")
    .insert({
      x_handle_normalized: sub.proposed_x_handle.trim(),
      display_name: sub.proposed_display_name.trim().slice(0, 200),
      trust_score: 50,
      status: "active",
      suspension_review_pending: false,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .maybeSingle();

  if (insErr || !insertedSource) {
    if ((insErr as { code?: string } | null)?.code === "23505") {
      return Response.json(
        { error: "That handle is already on the monitor list (race). Refresh and reject this duplicate.", code: "DUPLICATE" },
        { status: 409 }
      );
    }
    console.error("[mod/outside-source-submissions/approve] insert source", insErr);
    return Response.json({ error: "Could not create monitor entry" }, { status: 500 });
  }

  const sourceId = (insertedSource as { id: string }).id;

  const { data: finalized, error: finErr } = await db
    .from("outside_source_submissions")
    .update({
      approver_2_discord_id: modId,
      approver_2_at: nowIso,
      resolved_source_id: sourceId,
      resolved_at: nowIso,
      status: "approved",
      updated_at: nowIso,
    })
    .eq("id", submissionId)
    .eq("status", "pending")
    .not("approver_1_discord_id", "is", null)
    .is("approver_2_discord_id", null)
    .neq("approver_1_discord_id", modId)
    .select("id")
    .maybeSingle();

  if (finErr) {
    await db.from("outside_x_sources").delete().eq("id", sourceId);
    console.error("[mod/outside-source-submissions/approve] finalize", finErr);
    return Response.json({ error: "Could not finalize submission" }, { status: 500 });
  }

  if (!finalized) {
    await db.from("outside_x_sources").delete().eq("id", sourceId);
    return Response.json(
      { error: "Submission state changed; the monitor entry was not linked. Refresh and try again.", code: "RACE" },
      { status: 409 }
    );
  }

  return Response.json({
    success: true,
    step: "approved",
    sourceId,
    message: "Source is live for Outside Calls ingestion.",
  });
}
