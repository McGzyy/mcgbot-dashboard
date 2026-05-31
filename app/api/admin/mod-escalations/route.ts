import { requireDashboardAdmin } from "@/lib/adminGate";
import { listModEscalations, resolveModEscalation } from "@/lib/mod/modQueueOps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapRow(r: Awaited<ReturnType<typeof listModEscalations>>[number]) {
  return {
    id: r.id,
    subjectType: r.subjectType,
    subjectId: r.subjectId,
    raisedByDiscordId: r.raisedByDiscordId,
    status: r.status,
    reason: r.reason,
    detail: r.detail,
    adminNotes: r.adminNotes,
    resolvedAt: r.resolvedAt,
    resolvedByDiscordId: r.resolvedByDiscordId,
    createdAt: r.createdAt,
  };
}

export async function GET(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const statusParam = new URL(request.url).searchParams.get("status")?.trim().toLowerCase();
  const status =
    statusParam === "open" || statusParam === "resolved" || statusParam === "dismissed"
      ? statusParam
      : statusParam === "all"
        ? null
        : "open";

  const rows = await listModEscalations({ status, limit: 100 });
  return Response.json({ success: true, escalations: rows.map(mapRow) });
}

export async function PATCH(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: "resolved" | "dismissed";
    adminNotes?: string | null;
  } | null;

  const id = body?.id?.trim() ?? "";
  const status = body?.status;
  if (!id || (status !== "resolved" && status !== "dismissed")) {
    return Response.json({ success: false, error: "id and status (resolved|dismissed) are required." }, { status: 400 });
  }

  const row = await resolveModEscalation({
    id,
    status,
    resolvedByDiscordId: gate.discordId,
    adminNotes: body?.adminNotes,
  });

  if (!row) {
    return Response.json({ success: false, error: "Could not update escalation (maybe already closed)." }, { status: 404 });
  }

  return Response.json({ success: true, escalation: mapRow(row) });
}
