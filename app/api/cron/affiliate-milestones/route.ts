import { listAffiliateAccounts } from "@/lib/affiliate/affiliateDb";
import { evaluateAffiliateMilestones } from "@/lib/affiliate/affiliateMilestones";

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

/** Re-evaluate milestone tiers (e.g. 7-day tier-1 actives). Schedule daily. */
export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const accounts = await listAffiliateAccounts(500);
  let evaluated = 0;
  for (const a of accounts) {
    if (a.status !== "active") continue;
    await evaluateAffiliateMilestones(a.id);
    evaluated += 1;
  }
  return Response.json({ success: true, evaluated });
}

export async function GET(request: Request) {
  return POST(request);
}
