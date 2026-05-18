import { requireDashboardAdmin } from "@/lib/adminGate";
import { listAffiliateCommissionsForAdmin } from "@/lib/affiliate/affiliateCommissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const rows = await listAffiliateCommissionsForAdmin(250);
  return Response.json({ success: true, commissions: rows });
}
