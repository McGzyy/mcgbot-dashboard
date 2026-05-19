import {
  AFFILIATE_SUPPORT_CATEGORIES,
  affiliateSupportCategoryLabel,
  createAffiliateSupportTicket,
  listAffiliateSupportTicketsForPartner,
} from "@/lib/affiliate/affiliateSupportTickets";
import { queueAffiliateSupportTicketOpsEmail } from "@/lib/affiliate/affiliateNotifications";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const tickets = await listAffiliateSupportTicketsForPartner(auth.session.affiliateId);
  return Response.json({ success: true, tickets, categories: AFFILIATE_SUPPORT_CATEGORIES });
}

export async function POST(request: Request) {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const category = typeof body?.category === "string" ? body.category : "";
  const subject = typeof body?.subject === "string" ? body.subject : "";
  const message = typeof body?.message === "string" ? body.message : "";

  const created = await createAffiliateSupportTicket({
    affiliateId: auth.session.affiliateId,
    category,
    subject,
    message,
  });

  if (!created.ok) {
    return Response.json({ success: false, error: created.error }, { status: 400 });
  }

  queueAffiliateSupportTicketOpsEmail({
    ticketId: created.ticket.id,
    affiliateId: auth.session.affiliateId,
    subject: created.ticket.subject,
    categoryLabel: affiliateSupportCategoryLabel(created.ticket.category),
  });

  return Response.json({ success: true, ticket: created.ticket });
}
