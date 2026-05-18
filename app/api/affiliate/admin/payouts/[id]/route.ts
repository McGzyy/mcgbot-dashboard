import { requireAffiliateOpsAdmin } from "@/lib/affiliate/requireAffiliateOpsAccess";
import {
  updateAffiliatePayoutRequestStatus,
  type AffiliatePayoutStatus,
} from "@/lib/affiliate/affiliatePayouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const gate = await requireAffiliateOpsAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const statusRaw = typeof body?.status === "string" ? body.status.trim() : "";
  const status: AffiliatePayoutStatus | null =
    statusRaw === "pending" ||
    statusRaw === "approved" ||
    statusRaw === "paid" ||
    statusRaw === "rejected"
      ? statusRaw
      : null;
  const adminNote = typeof body?.adminNote === "string" ? body.adminNote : undefined;

  if (!status) {
    return Response.json({ success: false, error: "Invalid status." }, { status: 400 });
  }

  const ok = await updateAffiliatePayoutRequestStatus({
    requestId: id,
    status,
    adminNote,
    reviewedByDiscordId: gate.discordId,
  });
  if (!ok) {
    return Response.json({ success: false, error: "Update failed." }, { status: 500 });
  }

  return Response.json({ success: true, status });
}
