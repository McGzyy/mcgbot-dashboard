import { requireAffiliateOpsAdmin } from "@/lib/affiliate/requireAffiliateOpsAccess";
import { getAffiliateById } from "@/lib/affiliate/affiliateDb";
import { listAffiliateSupportTicketsForAdmin } from "@/lib/affiliate/affiliateSupportTickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireAffiliateOpsAdmin();
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam === "open" || statusParam === "closed" || statusParam === "all" ? statusParam : "all";

  const tickets = await listAffiliateSupportTicketsForAdmin({ status });
  const enriched = await Promise.all(
    tickets.map(async (t) => {
      const account = await getAffiliateById(t.affiliateId);
      return {
        ...t,
        affiliateEmail: account?.email ?? null,
        affiliateDisplayName: account?.displayName ?? account?.application.legalName ?? null,
      };
    })
  );

  return Response.json({ success: true, tickets: enriched });
}
