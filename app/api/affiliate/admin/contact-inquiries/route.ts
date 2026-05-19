import { requireAffiliateOpsAdmin } from "@/lib/affiliate/requireAffiliateOpsAccess";
import { listPublicContactInquiries } from "@/lib/affiliate/affiliatePublicContactAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireAffiliateOpsAdmin();
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam === "open" || statusParam === "closed" || statusParam === "all" ? statusParam : "all";

  const inquiries = await listPublicContactInquiries({ status });
  return Response.json({ success: true, inquiries });
}
