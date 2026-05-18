import { requireDashboardAdmin } from "@/lib/adminGate";
import {
  updateAffiliateAccountCommissionRateBps,
  updateAffiliateAccountStatus,
} from "@/lib/affiliate/affiliateDb";
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
    statusRaw === "pending" || statusRaw === "active" || statusRaw === "suspended" ? statusRaw : null;

  const hasBps = body?.commissionRateBps !== undefined && body?.commissionRateBps !== null;
  const bps = hasBps ? Math.floor(Number(body?.commissionRateBps)) : NaN;

  if (!status && !hasBps) {
    return Response.json({ success: false, error: "Provide status and/or commissionRateBps" }, { status: 400 });
  }

  if (hasBps && (!Number.isFinite(bps) || bps < 0 || bps > 10000)) {
    return Response.json({ success: false, error: "commissionRateBps must be 0–10000" }, { status: 400 });
  }

  if (status) {
    const ok = await updateAffiliateAccountStatus(id, status);
    if (!ok) {
      return Response.json({ success: false, error: "Status update failed" }, { status: 500 });
    }
  }

  if (hasBps) {
    const ok = await updateAffiliateAccountCommissionRateBps(id, bps);
    if (!ok) {
      return Response.json({ success: false, error: "Commission rate update failed" }, { status: 500 });
    }
  }

  return Response.json({ success: true, status: status ?? undefined, commissionRateBps: hasBps ? bps : undefined });
}
