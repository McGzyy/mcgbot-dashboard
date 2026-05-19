import { requireAffiliateOpsAdmin } from "@/lib/affiliate/requireAffiliateOpsAccess";
import {
  getAffiliateSupportTicketForAdmin,
  setAffiliateSupportTicketStatus,
  type AffiliateSupportTicketStatus,
} from "@/lib/affiliate/affiliateSupportTickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requireAffiliateOpsAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const ticket = await getAffiliateSupportTicketForAdmin(id);
  if (!ticket) {
    return Response.json({ success: false, error: "Ticket not found." }, { status: 404 });
  }

  return Response.json({ success: true, ticket });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireAffiliateOpsAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const statusRaw = typeof body?.status === "string" ? body.status.trim() : "";
  const status: AffiliateSupportTicketStatus | null =
    statusRaw === "open" || statusRaw === "closed" ? statusRaw : null;

  if (!status) {
    return Response.json({ success: false, error: "Invalid status." }, { status: 400 });
  }

  const updated = await setAffiliateSupportTicketStatus(id, status);
  if (!updated.ok) {
    return Response.json({ success: false, error: updated.error }, { status: 400 });
  }

  const ticket = await getAffiliateSupportTicketForAdmin(id);
  return Response.json({ success: true, ticket });
}
