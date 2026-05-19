import { requireAffiliateOpsAdmin } from "@/lib/affiliate/requireAffiliateOpsAccess";
import {
  setPublicContactInquiryStatus,
  type PublicContactInquiryStatus,
} from "@/lib/affiliate/affiliatePublicContactAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requireAffiliateOpsAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  const status = body?.status === "closed" || body?.status === "open" ? body.status : null;
  if (!status) {
    return Response.json({ success: false, error: "status must be open or closed." }, { status: 400 });
  }

  const result = await setPublicContactInquiryStatus(id, status as PublicContactInquiryStatus);
  if (!result.ok) {
    return Response.json({ success: false, error: result.error }, { status: 400 });
  }
  return Response.json({ success: true });
}
