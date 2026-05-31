import { requireDashboardAdmin } from "@/lib/adminGate";
import { listModStaffRoster, modStaffNeedsAgreement } from "@/lib/mod/modStaffDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const rows = await listModStaffRoster();
  return Response.json({
    success: true,
    staff: rows.map((r) => ({
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
    })),
  });
}
