import { requireDashboardAdmin } from "@/lib/adminGate";
import { createAffiliateAccount, listAffiliateAccounts } from "@/lib/affiliate/affiliateDb";
import type { AffiliateAccountStatus } from "@/lib/affiliate/affiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const accounts = await listAffiliateAccounts();
  return Response.json({ success: true, accounts });
}

export async function POST(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName : null;
  const statusRaw = typeof body?.status === "string" ? body.status.trim() : "pending";
  const status: AffiliateAccountStatus =
    statusRaw === "active" || statusRaw === "suspended" ? statusRaw : "pending";
  const commissionRateBps = Number(body?.commissionRateBps);

  const created = await createAffiliateAccount({
    email,
    password,
    displayName,
    status,
    commissionRateBps: Number.isFinite(commissionRateBps) ? commissionRateBps : undefined,
  });

  if (!created.ok) {
    return Response.json({ success: false, error: created.error }, { status: 400 });
  }

  return Response.json({ success: true, account: created.account });
}
