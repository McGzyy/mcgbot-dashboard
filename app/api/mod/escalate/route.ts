import { createModEscalation, recordModStaffAudit } from "@/lib/mod/modQueueOps";
import { requireModOrAdmin } from "@/lib/modStaffAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireModOrAdmin();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    subjectType?: string;
    subjectId?: string;
    reason?: string;
    detail?: Record<string, unknown>;
  } | null;

  const subjectType = body?.subjectType?.trim() ?? "";
  const subjectId = body?.subjectId?.trim() ?? "";
  const reason = body?.reason?.trim() ?? "";
  if (!subjectType || !subjectId || !reason) {
    return Response.json(
      { success: false, error: "subjectType, subjectId, and reason are required." },
      { status: 400 }
    );
  }

  const row = await createModEscalation({
    subjectType,
    subjectId,
    raisedByDiscordId: auth.staffDiscordId,
    reason,
    detail: body?.detail,
  });

  if (!row) {
    return Response.json(
      { success: false, error: "Could not create escalation. Confirm mod_escalations migration ran." },
      { status: 500 }
    );
  }

  void recordModStaffAudit({
    discordId: auth.staffDiscordId,
    action: "other",
    subjectType: "escalation",
    subjectId: row.id,
    detail: { queueSubjectType: subjectType, queueSubjectId: subjectId, reason: reason.slice(0, 200) },
  });

  return Response.json({
    success: true,
    escalation: {
      id: row.id,
      status: row.status,
      createdAt: row.createdAt,
    },
  });
}
