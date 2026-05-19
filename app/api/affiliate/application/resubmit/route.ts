import { resubmitAffiliateApplication } from "@/lib/affiliate/affiliateDb";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";
import { validateAffiliateApplication } from "@/lib/affiliate/validateAffiliateApplication";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAffiliateSession({ requireVerified: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const appParsed = validateAffiliateApplication(body ?? {});
  if (!appParsed.ok) {
    return Response.json({ success: false, error: appParsed.error }, { status: 400 });
  }

  const result = await resubmitAffiliateApplication(auth.session.affiliateId, appParsed.value);
  if (!result.ok) {
    return Response.json({ success: false, error: result.error }, { status: 400 });
  }

  return Response.json({ success: true, status: result.account.status });
}
