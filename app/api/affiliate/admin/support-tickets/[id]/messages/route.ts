import { requireAffiliateOpsAdmin } from "@/lib/affiliate/requireAffiliateOpsAccess";
import { addAffiliateSupportTicketMessage } from "@/lib/affiliate/affiliateSupportTickets";
import { queueAffiliateSupportTicketOpsReplyEmail } from "@/lib/affiliate/affiliateNotifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requireAffiliateOpsAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const message = typeof body?.message === "string" ? body.message : "";

  const result = await addAffiliateSupportTicketMessage({
    ticketId: id,
    authorRole: "ops",
    message,
  });

  if (!result.ok) {
    const status = result.notFound ? 404 : 400;
    return Response.json({ success: false, error: result.error }, { status });
  }

  queueAffiliateSupportTicketOpsReplyEmail({
    affiliateId: result.ticket.affiliateId,
    subject: result.ticket.subject,
  });

  return Response.json({ success: true, ticket: result.ticket });
}
