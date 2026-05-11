import { settleDueReferralCredits } from "@/lib/referralRewards";

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

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { settled } = await settleDueReferralCredits();
  return Response.json({ success: true, settled });
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { settled } = await settleDueReferralCredits();
  return Response.json({ success: true, settled });
}
