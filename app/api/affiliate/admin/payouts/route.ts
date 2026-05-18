import { requireAffiliateOpsAdmin } from "@/lib/affiliate/requireAffiliateOpsAccess";
import { listAllPayoutRequests } from "@/lib/affiliate/affiliatePayouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAffiliateOpsAdmin();
  if (!gate.ok) return gate.response;

  const requests = await listAllPayoutRequests();
  return Response.json({ success: true, requests });
}
