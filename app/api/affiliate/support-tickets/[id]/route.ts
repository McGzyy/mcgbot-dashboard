import { getAffiliateSupportTicketForPartner } from "@/lib/affiliate/affiliateSupportTickets";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const ticket = await getAffiliateSupportTicketForPartner(id, auth.session.affiliateId);
  if (!ticket) {
    return Response.json({ success: false, error: "Ticket not found." }, { status: 404 });
  }

  return Response.json({ success: true, ticket });
}
