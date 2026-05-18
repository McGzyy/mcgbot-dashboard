import { requireDashboardAdmin } from "@/lib/adminGate";
import { voidAffiliateCommissionById } from "@/lib/affiliate/affiliateCommissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== "void") {
    return Response.json({ success: false, error: "Unsupported action" }, { status: 400 });
  }

  const ok = await voidAffiliateCommissionById(id);
  if (!ok) {
    return Response.json({ success: false, error: "Could not void (already paid or missing)." }, { status: 400 });
  }
  return Response.json({ success: true });
}
