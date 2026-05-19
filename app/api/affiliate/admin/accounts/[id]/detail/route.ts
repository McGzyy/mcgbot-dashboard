import { getAffiliateAdminPartnerDetail } from "@/lib/affiliate/affiliateAdminPartnerDetail";
import { requireAffiliateOpsAdmin } from "@/lib/affiliate/requireAffiliateOpsAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const gate = await requireAffiliateOpsAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const detail = await getAffiliateAdminPartnerDetail(id);
  if (!detail) {
    return Response.json({ success: false, error: "Affiliate not found." }, { status: 404 });
  }

  return Response.json({ success: true, detail });
}
