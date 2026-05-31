import { requireDashboardAdmin } from "@/lib/adminGate";
import {
  inviteModStaffAdmin,
  listModStaffRoster,
  modStaffNeedsAgreement,
  type ModStaffRoleTier,
  type ModStaffStatus,
  updateModStaffAdmin,
} from "@/lib/mod/modStaffDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapStaffRow(r: Awaited<ReturnType<typeof listModStaffRoster>>[number]) {
  return {
    discordId: r.discordId,
    displayName: r.displayName,
    status: r.status,
    roleTier: r.roleTier,
    agreementVersion: r.agreementVersion,
    agreementSignedAt: r.agreementSignedAt,
    needsAgreement: modStaffNeedsAgreement(r),
    invitedAt: r.invitedAt,
    activatedAt: r.activatedAt,
    stipendCents: r.stipendCents,
    payoutNotes: r.payoutNotes,
    updatedAt: r.updatedAt,
  };
}

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const rows = await listModStaffRoster();
  return Response.json({
    success: true,
    staff: rows.map(mapStaffRow),
  });
}

export async function POST(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as {
    discordId?: string;
    displayName?: string | null;
    roleTier?: ModStaffRoleTier;
    stipendCents?: number | null;
    payoutNotes?: string | null;
  } | null;

  const result = await inviteModStaffAdmin({
    discordId: body?.discordId ?? "",
    displayName: body?.displayName,
    roleTier: body?.roleTier === "head_mod" ? "head_mod" : "mod",
    stipendCents: body?.stipendCents,
    payoutNotes: body?.payoutNotes,
  });

  if (!result.ok) {
    return Response.json({ success: false, error: result.error }, { status: 400 });
  }

  return Response.json({ success: true, staff: mapStaffRow(result.row) });
}

export async function PATCH(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as {
    discordId?: string;
    displayName?: string | null;
    status?: ModStaffStatus;
    roleTier?: ModStaffRoleTier;
    stipendCents?: number | null;
    payoutNotes?: string | null;
  } | null;

  const discordId = body?.discordId?.trim() ?? "";
  if (!discordId) {
    return Response.json({ success: false, error: "discordId is required." }, { status: 400 });
  }

  const status =
    body?.status === "invited" ||
    body?.status === "active" ||
    body?.status === "suspended" ||
    body?.status === "terminated"
      ? body.status
      : undefined;

  const row = await updateModStaffAdmin({
    discordId,
    displayName: body?.displayName,
    status,
    roleTier: body?.roleTier === "head_mod" ? "head_mod" : body?.roleTier === "mod" ? "mod" : undefined,
    stipendCents: body?.stipendCents,
    payoutNotes: body?.payoutNotes,
  });

  if (!row) {
    return Response.json({ success: false, error: "Could not update roster row." }, { status: 500 });
  }

  return Response.json({ success: true, staff: mapStaffRow(row) });
}
