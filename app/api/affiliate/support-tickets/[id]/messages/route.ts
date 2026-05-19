import { addAffiliateSupportTicketMessage } from "@/lib/affiliate/affiliateSupportTickets";
import { queueAffiliateSupportTicketPartnerReplyEmail } from "@/lib/affiliate/affiliateNotifications";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const message = typeof body?.message === "string" ? body.message : "";

  const result = await addAffiliateSupportTicketMessage({
    ticketId: id,
    affiliateId: auth.session.affiliateId,
    authorRole: "partner",
    message,
  });

  if (!result.ok) {
    const status = result.notFound ? 404 : 400;
    return Response.json({ success: false, error: result.error }, { status });
  }

  queueAffiliateSupportTicketPartnerReplyEmail({
    ticketId: result.ticket.id,
    affiliateId: auth.session.affiliateId,
    subject: result.ticket.subject,
  });

  return Response.json({ success: true, ticket: result.ticket });
}
