import { NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/requireDashboardSession";
import { disableTotp } from "@/lib/dashboardTotpUser";
import { clearTotpDeviceTrustCookie } from "@/lib/totpDeviceTrustCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireDashboardSession();
  if (!auth.ok) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }
  const code = typeof (body as { code?: unknown })?.code === "string" ? (body as { code: string }).code : "";
  const res = await disableTotp(auth.discordId, code);
  if (!res.ok) {
    return Response.json({ success: false, error: res.error }, { status: 400 });
  }
  const out = NextResponse.json({ success: true });
  clearTotpDeviceTrustCookie(out);
  return out;
}
