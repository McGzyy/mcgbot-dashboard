import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { meetsModerationMinTier, moderationStaffForbiddenPayload, resolveHelpTierAsync } from "@/lib/helpRole";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}

export async function POST(request: Request, ctx: Ctx) {
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

  let reason: string | null = null;
  try {
    const body = await request.json();
    if (body && typeof body === "object" && typeof (body as { reason?: unknown }).reason === "string") {
      const r = clip((body as { reason: string }).reason, 500);
      reason = r.length ? r : null;
    }
  } catch {
    reason = null;
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error } = await db
    .from("outside_source_submissions")
    .update({
      status: "rejected",
      reject_reason: reason,
      updated_at: nowIso,
    })
    .eq("id", submissionId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[mod/outside-source-submissions/reject]", error);
    return Response.json({ error: "Update failed" }, { status: 500 });
  }
  if (!updated) {
    return Response.json({ error: "Submission is not pending" }, { status: 400 });
  }

  return Response.json({ success: true, message: "Submission rejected." });
}
