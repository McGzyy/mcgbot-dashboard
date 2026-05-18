import { requireAffiliateOpsAdmin } from "@/lib/affiliate/requireAffiliateOpsAccess";
import { listAffiliateCommissionsForAdmin } from "@/lib/affiliate/affiliateCommissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAffiliateOpsAdmin();
  if (!gate.ok) return gate.response;

  const rows = await listAffiliateCommissionsForAdmin(250);
  return Response.json({ success: true, commissions: rows });
}
