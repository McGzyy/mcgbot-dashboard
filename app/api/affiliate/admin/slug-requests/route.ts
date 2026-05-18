import {
  approveAffiliateSlugChange,
  listAffiliateSlugChangeRequests,
  rejectAffiliateSlugChange,
} from "@/lib/affiliate/affiliateDb";
import { requireAffiliateOpsAdmin } from "@/lib/affiliate/requireAffiliateOpsAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAffiliateOpsAdmin();
  if (!gate.ok) return gate.response;

  const requests = await listAffiliateSlugChangeRequests();
  return Response.json({ success: true, requests });
}

export async function POST(request: Request) {
  const gate = await requireAffiliateOpsAdmin();
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const affiliateId = typeof body?.affiliateId === "string" ? body.affiliateId.trim() : "";
  const action = typeof body?.action === "string" ? body.action.trim() : "";

  if (!affiliateId || (action !== "approve" && action !== "reject")) {
    return Response.json({ success: false, error: "affiliateId and action required." }, { status: 400 });
  }

  const ok =
    action === "approve"
      ? await approveAffiliateSlugChange(affiliateId)
      : await rejectAffiliateSlugChange(affiliateId);
  if (!ok) {
    return Response.json({ success: false, error: "Action failed." }, { status: 500 });
  }

  return Response.json({ success: true, action });
}
