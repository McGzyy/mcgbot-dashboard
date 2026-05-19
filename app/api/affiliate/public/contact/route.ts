import { NextResponse } from "next/server";
import { submitAffiliatePublicContact } from "@/lib/affiliate/affiliatePublicContact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const result = await submitAffiliatePublicContact({
    name: typeof body?.name === "string" ? body.name : "",
    email: typeof body?.email === "string" ? body.email : "",
    category: typeof body?.category === "string" ? body.category : "",
    subject: typeof body?.subject === "string" ? body.subject : "",
    message: typeof body?.message === "string" ? body.message : "",
    honeypot: typeof body?.honeypot === "string" ? body.honeypot : "",
    pagePath: typeof body?.pagePath === "string" ? body.pagePath : null,
    userAgent: request.headers.get("user-agent"),
    ip: clientIp(request),
  });

  if (!result.ok) {
    const status = result.retryAfterSec ? 429 : 400;
    return NextResponse.json({ success: false, error: result.error }, { status });
  }

  return NextResponse.json({ success: true, id: result.id });
}
