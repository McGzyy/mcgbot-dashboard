import { approveEligibleAffiliateCommissions } from "@/lib/affiliate/affiliateCommissionApproval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorizeCron(request: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const header = (request.headers.get("x-cron-secret") ?? "").trim();
  return bearer === secret || header === secret;
}

/** Auto-approve rev-share commissions after the hold window. Schedule hourly. */
export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { approved } = await approveEligibleAffiliateCommissions();
  return Response.json({ success: true, approved });
}

export async function GET(request: Request) {
  return POST(request);
}
