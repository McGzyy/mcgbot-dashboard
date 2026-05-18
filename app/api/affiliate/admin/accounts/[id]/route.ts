import { requireDashboardAdmin } from "@/lib/adminGate";
import { updateAffiliateAccountStatus } from "@/lib/affiliate/affiliateDb";
import type { AffiliateAccountStatus } from "@/lib/affiliate/affiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const statusRaw = typeof body?.status === "string" ? body.status.trim() : "";
  const status: AffiliateAccountStatus | null =
    statusRaw === "pending" || statusRaw === "active" || statusRaw === "suspended"
      ? statusRaw
      : null;

  if (!status) {
    return Response.json({ success: false, error: "Invalid status" }, { status: 400 });
  }

  const ok = await updateAffiliateAccountStatus(id, status);
  if (!ok) {
    return Response.json({ success: false, error: "Update failed" }, { status: 500 });
  }

  return Response.json({ success: true, status });
}
